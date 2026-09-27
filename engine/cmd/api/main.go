// Command api é o ponto de entrada do motor de simulação.
package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata" // fuso da agenda (America/Sao_Paulo) sem depender do tzdata da imagem

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/macroeventtrigger"
	"tcc-investimentos/engine/internal/domain/marketcalendar"
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
		// as rotas de renda fixa, POST/GET /macro-events, as rotas de leitura
		// de conta/posições/extrato (tarefa 4.7) e GET /market/indicators/history
		// (tarefa M.2) respondem 503 (ver internal/infra/httpserver/account.go,
		// assets.go, admin.go, fixedincome.go, macroevents.go, positions.go e
		// indicators.go).
		if err := httpserver.Run(addr, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil); err != nil {
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

	seed := int64(defaultSimulationSeed)
	if raw := os.Getenv("SIMULATION_SEED"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			log.Fatalf("SIMULATION_SEED inválida: %v", err)
		}
		seed = parsed
	}

	accountRepository := db.NewAccountRepository(pool)
	accountService := account.NewService(accountRepository)
	catalogRepository := db.NewCatalogRepository(pool, quoteCache)
	orderExecutionRepository := db.NewOrderExecutionRepository(pool, quoteCache)
	orderExecutionService := orderexecution.NewService(orderExecutionRepository)
	// ipcaSeed (tarefa L.2) nunca reaproveita a seed raw do selicConfig
	// abaixo — os dois processos estocásticos (selic.Series/ipca.
	// MonthlySeries) são independentes de propósito (spec 3.2/6 da
	// proposta motor-mercado-realista); usar exatamente a mesma seed nos
	// dois consumiria o mesmo stream de math/rand em paralelo, correlacionando
	// o ruído de dois indicadores que deveriam poder divergir.
	ipcaSeed := seed + 1
	fixedIncomeExecutionService := fixedincomeexecution.NewService(db.NewFixedIncomeExecutionRepository(pool), ipca.DefaultConfig(ipcaSeed))
	macroEventRepository := db.NewMacroEventRepository(pool)
	macroEventTriggerService := macroeventtrigger.NewService(macroEventRepository)
	botRepository := db.NewBotRepository(pool)

	selicConfig := selic.DefaultConfig(selic.DefaultNeutralRate, seed)
	// ipcaConfig usa seed+1, não a mesma seed de selicConfig — os dois
	// processos são singletons globais (sem id de entidade pra derivar via
	// deterministicSeed, tick.go), então um offset fixo é quem decorrelaciona
	// o ruído mensal do IPCA do ruído diário da Selic (tarefa M.1); mesmos
	// SIMULATION_SEED entre reinícios continuam determinísticos (RNF08).
	ipcaConfig := ipca.DefaultConfig(seed + 1)
	tickRepository := db.NewTickRepository(pool, quoteCache)
	// bots/tickRepository (histórico de preço/volume)/orderExecutionRepository
	// (peek de contexto + ciclo de vida de ordem, achado 005)/
	// orderExecutionService (submissão) alimentam a coleta de decisão de bot
	// dentro do sub-tick (Fase D.2, tick/rounds.go) — ordem de bot passa pelo
	// mesmíssimo orderexecution.Service que POST /orders já usa, sem caminho
	// paralelo. tickRepository e orderExecutionRepository são cada um
	// repassados duas vezes (PriceHistoryReader+TradedVolumeReader e
	// OrderContextLoader+OrderLifecycleManager, respectivamente) — a mesma
	// instância concreta já implementa os dois papéis.
	tickService := tick.NewService(tickRepository, botRepository, tickRepository, tickRepository, orderExecutionRepository, orderExecutionService, orderExecutionRepository, selicConfig, ipcaConfig, seed)
	// ETF (Fase R, tarefa R.3): emissão inicial pelo Participante Autorizado e
	// NAV diário; o mesmo repositório de fundos cobre a leitura e o caixa.
	etfFundRepository := db.NewETFFundRepository(pool)
	etfShareRepository := db.NewETFShareRepository(pool)
	coverageRepository := db.NewCoverageRepository(pool)
	tickService.WithETF(tick.ETFDeps{
		Funds:       etfFundRepository,
		Participant: etfFundRepository,
		Exchanger:   etfShareRepository,
		Transferer:  etfShareRepository,
		Coverage:    coverage.NewEnsurer(coverageRepository, coverageRepository),
	})

	// Agenda automática do Temporizador (tarefas 3.11 e S.3) — roda em segundo
	// plano enquanto o servidor HTTP atende requisições; POST /admin/tick
	// (handleAdminTick) dispara o mesmo Run fora da agenda. A trava consultiva do
	// Postgres (Guard) serializa os dois e as instâncias entre si.
	tickService.WithGuard(tickRepository)
	calendarRepository := db.NewCalendarRepository(pool)
	calendarAPI := &httpserver.CalendarAPI{
		Service:        marketcalendar.NewService(calendarRepository, calendarRepository),
		DaysPerRealDay: envInt("SIMULATION_DAYS_PER_REAL_DAY", 5),
	}
	if scheduleCfg, enabled := loadScheduleConfig(); enabled {
		calendarAPI.NextTick = scheduleCfg.NextSlotStart
		tickerCtx, stopTicker := context.WithCancel(context.Background())
		defer stopTicker()
		go scheduler.Run(tickerCtx, scheduleCfg, time.Now, tickService.RunScheduled)
	} else {
		log.Print("agenda automática do Temporizador desligada (TICK_SCHEDULER_ENABLED=false)")
	}

	if err := httpserver.Run(addr, accountService, catalogRepository, tickService, orderExecutionService, fixedIncomeExecutionService, macroEventTriggerService, macroEventRepository, accountRepository, tickRepository, calendarAPI); err != nil {
		log.Fatalf("motor de simulação encerrou com erro: %v", err)
	}
}

// loadScheduleConfig lê a agenda do tick do ambiente (tarefa S.3):
// SIMULATION_DAYS_PER_REAL_DAY (padrão 5: 1 dia real = 5 dias simulados, um tick
// por dia simulado), TICK_MAX_CATCHUP (padrão 3, teto de dias recuperados
// depois de uma parada), SCHEDULER_TIMEZONE (padrão America/Sao_Paulo) e
// TICK_SCHEDULER_ENABLED (padrão true; false nos ambientes de teste que
// disparam o tick à mão).
func loadScheduleConfig() (scheduler.Config, bool) {
	if strings.EqualFold(os.Getenv("TICK_SCHEDULER_ENABLED"), "false") {
		return scheduler.Config{}, false
	}
	cfg := scheduler.Config{TicksPerDay: envInt("SIMULATION_DAYS_PER_REAL_DAY", 5), MaxCatchUp: envInt("TICK_MAX_CATCHUP", 3)}
	zone := os.Getenv("SCHEDULER_TIMEZONE")
	if zone == "" {
		zone = "America/Sao_Paulo"
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		log.Fatalf("SCHEDULER_TIMEZONE inválida: %v", err)
	}
	cfg.Location = loc
	return cfg, true
}

func envInt(name string, fallback int) int {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 {
		log.Fatalf("%s inválida: precisa ser um inteiro >= 1", name)
	}
	return v
}
