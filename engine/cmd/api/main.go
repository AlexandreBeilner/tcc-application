// Command api é o ponto de entrada do motor de simulação.
package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/macroeventtrigger"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/tick"
	"tcc-investimentos/engine/internal/infra/cache"
	"tcc-investimentos/engine/internal/infra/db"
	"tcc-investimentos/engine/internal/infra/httpserver"
	"tcc-investimentos/engine/internal/infra/scheduler"
)

// defaultSimulationSeed é usada quando SIMULATION_SEED não está configurada
// — RNF08 exige série determinística mesmo entre reinícios, então qualquer
// ambiente sem a env var explícita ainda precisa de uma seed fixa, nunca
// aleatória por processo.
const defaultSimulationSeed = 42

// engineQuoteCache espelha a assinatura da porta quoteCache não-exportada
// declarada em internal/infra/db (ponto de consumo) — precisa de um nome
// aqui só porque main.go escolhe qual adapter concreto construir antes de
// injetar; nenhum outro pacote precisa conhecer este tipo.
type engineQuoteCache interface {
	Get(ctx context.Context, assetID string) (catalog.Quote, bool, error)
	Set(ctx context.Context, assetID string, quote catalog.Quote) error
}

// newQuoteCache resolve o cache de cotação (tarefa 5.7): Redis quando
// REDIS_URL está configurada (sempre o caso sob docker-compose, CLAUDE.md —
// container é obrigatório pro backend inteiro), NoopQuoteCache caso
// contrário — nunca nil, pra nenhum dos repositórios precisar checar
// ausência de cache (ver nota em NewCatalogRepository sobre a armadilha de
// "typed nil").
func newQuoteCache() engineQuoteCache {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		return cache.NoopQuoteCache{}
	}
	client, err := cache.NewClient(redisURL)
	if err != nil {
		log.Fatalf("erro ao configurar client Redis (REDIS_URL): %v", err)
	}
	return cache.NewRedisQuoteCache(client)
}

func main() {
	addr := os.Getenv("ENGINE_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Sem DATABASE_URL, o motor sobe só com /health — POST /accounts,
		// as rotas de catálogo (incl. cotações, tarefa 4.6), POST /admin/tick,
		// as rotas de renda fixa, POST/GET /macro-events e as rotas de leitura
		// de conta/posições/extrato (tarefa 4.7) respondem 503 (ver
		// internal/infra/httpserver/account.go, assets.go, admin.go,
		// fixedincome.go, macroevents.go e positions.go).
		if err := httpserver.Run(addr, nil, nil, nil, nil, nil, nil, nil, nil); err != nil {
			log.Fatalf("motor de simulação encerrou com erro: %v", err)
		}
		return
	}

	if err := db.Migrate(databaseURL); err != nil {
		log.Fatalf("erro ao aplicar migrations: %v", err)
	}
	log.Print("migrations do banco market aplicadas")

	pool, err := db.Open(databaseURL)
	if err != nil {
		log.Fatalf("erro ao abrir conexão com o banco market: %v", err)
	}
	defer func() { _ = pool.Close() }()

	quoteCache := newQuoteCache()

	accountRepository := db.NewAccountRepository(pool)
	accountService := account.NewService(accountRepository)
	catalogRepository := db.NewCatalogRepository(pool, quoteCache)
	orderExecutionService := orderexecution.NewService(db.NewOrderExecutionRepository(pool, quoteCache))
	fixedIncomeExecutionService := fixedincomeexecution.NewService(db.NewFixedIncomeExecutionRepository(pool))
	macroEventRepository := db.NewMacroEventRepository(pool)
	macroEventTriggerService := macroeventtrigger.NewService(macroEventRepository)

	seed := int64(defaultSimulationSeed)
	if raw := os.Getenv("SIMULATION_SEED"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			log.Fatalf("SIMULATION_SEED inválida: %v", err)
		}
		seed = parsed
	}
	selicConfig := selic.DefaultConfig(selic.DefaultNeutralRate, seed)
	tickService := tick.NewService(db.NewTickRepository(pool, quoteCache), selicConfig, seed)

	// Job diário automático do Temporizador (tarefa 3.11) — roda em segundo
	// plano enquanto o servidor HTTP atende requisições; POST /admin/tick
	// (handleAdminTick) dispara o mesmo Run fora do agendamento.
	tickerCtx, stopTicker := context.WithCancel(context.Background())
	defer stopTicker()
	go scheduler.RunDaily(tickerCtx, 24*time.Hour, func(ctx context.Context) error {
		_, err := tickService.Run(ctx)
		return err
	})

	if err := httpserver.Run(addr, accountService, catalogRepository, tickService, orderExecutionService, fixedIncomeExecutionService, macroEventTriggerService, macroEventRepository, accountRepository); err != nil {
		log.Fatalf("motor de simulação encerrou com erro: %v", err)
	}
}
