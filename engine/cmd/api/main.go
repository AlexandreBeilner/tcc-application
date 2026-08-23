// Command api é o ponto de entrada do motor de simulação.
package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/tick"
	"tcc-investimentos/engine/internal/infra/db"
	"tcc-investimentos/engine/internal/infra/httpserver"
	"tcc-investimentos/engine/internal/infra/scheduler"
)

// defaultSimulationSeed é usada quando SIMULATION_SEED não está configurada
// — RNF08 exige série determinística mesmo entre reinícios, então qualquer
// ambiente sem a env var explícita ainda precisa de uma seed fixa, nunca
// aleatória por processo.
const defaultSimulationSeed = 42

func main() {
	addr := os.Getenv("ENGINE_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Sem DATABASE_URL, o motor sobe só com /health — POST /accounts,
		// as rotas de catálogo, POST /admin/tick e as rotas de renda fixa
		// respondem 503 (ver internal/infra/httpserver/account.go,
		// assets.go, admin.go e fixedincome.go).
		if err := httpserver.Run(addr, nil, nil, nil, nil, nil); err != nil {
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

	accountService := account.NewService(db.NewAccountRepository(pool))
	catalogRepository := db.NewCatalogRepository(pool)
	orderExecutionService := orderexecution.NewService(db.NewOrderExecutionRepository(pool))
	fixedIncomeExecutionService := fixedincomeexecution.NewService(db.NewFixedIncomeExecutionRepository(pool))

	seed := int64(defaultSimulationSeed)
	if raw := os.Getenv("SIMULATION_SEED"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			log.Fatalf("SIMULATION_SEED inválida: %v", err)
		}
		seed = parsed
	}
	selicConfig := selic.DefaultConfig(selic.DefaultNeutralRate, seed)
	tickService := tick.NewService(db.NewTickRepository(pool), selicConfig, seed)

	// Job diário automático do Temporizador (tarefa 3.11) — roda em segundo
	// plano enquanto o servidor HTTP atende requisições; POST /admin/tick
	// (handleAdminTick) dispara o mesmo Run fora do agendamento.
	tickerCtx, stopTicker := context.WithCancel(context.Background())
	defer stopTicker()
	go scheduler.RunDaily(tickerCtx, 24*time.Hour, func(ctx context.Context) error {
		_, err := tickService.Run(ctx)
		return err
	})

	if err := httpserver.Run(addr, accountService, catalogRepository, tickService, orderExecutionService, fixedIncomeExecutionService); err != nil {
		log.Fatalf("motor de simulação encerrou com erro: %v", err)
	}
}
