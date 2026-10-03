// Package httpserver monta o servidor HTTP do motor de simulação e registra
// as rotas — é a camada de infraestrutura que expõe o domínio, nunca o contrário.
package httpserver

import (
	"log"
	"net/http"
	"time"
)

// catalogReader é o colaborador que os handlers de /assets e
// /companies precisam pra ler o catálogo — junta os dois porque, na
// prática, uma única *db.CatalogRepository (tarefa 3.9) implementa ambos;
// cada handler ainda declara sua própria interface menor
// (assetCatalogReader/companyCatalogReader) pro que de fato consome.
type catalogReader interface {
	assetCatalogReader
	companyCatalogReader
}

// accountWriter é o colaborador que os handlers de escrita de conta
// precisam (POST /accounts, POST /accounts/:user_id/salary, tarefa T.2) —
// implementado por *account.Service, mesma junção de interfaces pequenas
// que catalogReader/userMarketDataReader já fazem pro mesmo colaborador
// concreto.
type accountWriter interface {
	accountOpener
	accountSalaryCrediter
}

// userMarketDataReader é o colaborador que os handlers de leitura de estado
// de usuário precisam (GET /accounts/:user_id, /accounts/:user_id/events,
// /positions, /fixed-income/positions) — implementado por
// *db.AccountRepository (tarefa 4.7), mesma junção de interfaces pequenas
// que catalogReader já faz pra CatalogRepository.
type userMarketDataReader interface {
	accountReader
	userEventLister
	positionLister
	fixedIncomePositionLister
}

// New monta o *http.Server com as rotas do motor de simulação registradas.
// accounts pode ser nil (ex: sem DATABASE_URL configurado) — POST
// /accounts e POST /accounts/:user_id/salary (tarefa T.2) respondem 503
// nesse caso; catalog, temporizador, orders,
// fixedIncome, macroEvents, macroEventReader, userData, indicatorHistory e calendar
// podem ser nil também — GET /assets, /assets/:id, /assets/:id/quotes,
// /assets/:id/book, /companies/:id, POST /admin/tick, POST /orders, POST
// /orders/:id/cancel, GET /orders, POST /fixed-income/purchases|redemptions,
// GET /fixed-income/simulate, POST /macro-events, GET /macro-events, GET
// /accounts/:user_id[/events], GET /positions, GET /fixed-income/positions,
// GET /market/indicators/history, GET /market/clock e GET /market/calendar respondem 503 nesse caso, em vez de
// panicar. As rotas do painel de Tempo (N.6: /admin/scheduler, /admin/ticks,
// /admin/tick/advance) só funcionam com WithSchedulerAdmin; sem ela respondem 503. As de leitura
// do painel (N.5/N.8/N.10: /admin/overview, /admin/market/assets[/{id}], /admin/orders) dependem de WithAdminReader, idem;
// o cancelamento por intervenção (N.10) depende de WithAdminOrderCanceller e as pausas de negociação (N.9:
// /admin/halts, GET /market/halts) de WithTradingHalts e a gestão de bots (N.1: /admin/bots) de WithBotAdmin.
func New(addr string, accounts accountWriter, catalog catalogReader, temporizador ticker, orders orderSubmitter, fixedIncome fixedIncomeExecutor, macroEvents macroEventTriggerer, macroEventReader macroEventLister, userData userMarketDataReader, indicatorHistory indicatorHistoryReader, calendar *CalendarAPI, opts ...Option) *http.Server {
	var cfg options
	for _, opt := range opts {
		opt(&cfg)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /accounts", handleCreateAccount(accounts))
	mux.HandleFunc("POST /accounts/{user_id}/salary", handleCreditSalary(accounts))
	mux.HandleFunc("GET /accounts/{user_id}", handleGetAccount(userData))
	mux.HandleFunc("GET /accounts/{user_id}/events", handleListAccountEvents(userData))
	mux.HandleFunc("GET /positions", handleListPositions(userData))
	mux.HandleFunc("GET /fixed-income/positions", handleListFixedIncomePositions(userData))
	mux.HandleFunc("GET /assets", handleListAssets(catalog))
	mux.HandleFunc("GET /assets/{id}", handleGetAsset(catalog))
	mux.HandleFunc("GET /assets/{id}/quotes", handleGetAssetQuoteHistory(catalog))
	mux.HandleFunc("GET /assets/{id}/book", handleGetAssetBook(catalog, orders))
	mux.HandleFunc("GET /companies/{id}", handleGetCompany(catalog))
	mux.HandleFunc("POST /admin/tick", handleAdminTick(temporizador))
	mux.HandleFunc("POST /admin/tick/advance", handleAdvanceTicks(cfg.scheduler))
	mux.HandleFunc("GET /admin/scheduler", handleGetScheduler(cfg.scheduler))
	mux.HandleFunc("POST /admin/scheduler/pause", handleSetSchedulerPaused(cfg.scheduler, true))
	mux.HandleFunc("POST /admin/scheduler/resume", handleSetSchedulerPaused(cfg.scheduler, false))
	mux.HandleFunc("GET /admin/ticks", handleListTicks(cfg.scheduler))
	mux.HandleFunc("GET /admin/overview", handleAdminOverview(cfg.adminReader))
	mux.HandleFunc("GET /admin/market/assets", handleAdminMarketAssets(cfg.adminReader))
	mux.HandleFunc("GET /admin/market/assets/{id}", handleAdminMarketAssetDetail(cfg.adminReader))
	mux.HandleFunc("GET /admin/orders", handleAdminOrders(cfg.adminReader))
	mux.HandleFunc("POST /admin/orders/cancel-batch", handleAdminCancelBatch(cfg.orderCanceller))
	mux.HandleFunc("POST /admin/orders/{id}/cancel", handleAdminCancelOrder(cfg.orderCanceller))
	mux.HandleFunc("GET /admin/halts", handleAdminListHalts(cfg.tradingHalts))
	mux.HandleFunc("POST /admin/halts", handleAdminPause(cfg.tradingHalts))
	mux.HandleFunc("POST /admin/halts/{id}/lift", handleAdminLift(cfg.tradingHalts))
	mux.HandleFunc("GET /market/halts", handleMarketHalts(cfg.tradingHalts))
	mux.HandleFunc("GET /admin/bots", handleAdminListBots(cfg.botManager))
	mux.HandleFunc("POST /admin/bots", handleAdminCreateBot(cfg.botManager))
	mux.HandleFunc("PATCH /admin/bots/{id}", handleAdminUpdateBot(cfg.botManager))
	mux.HandleFunc("POST /orders", handleSubmitOrder(catalog, orders))
	mux.HandleFunc("POST /orders/{id}/cancel", handleCancelOrder(orders))
	mux.HandleFunc("GET /orders", handleListOrders(orders))
	mux.HandleFunc("POST /fixed-income/purchases", handleFixedIncomePurchase(catalog, fixedIncome))
	mux.HandleFunc("POST /fixed-income/redemptions", handleFixedIncomeRedemption(catalog, fixedIncome))
	mux.HandleFunc("GET /fixed-income/simulate", handleFixedIncomeSimulate(catalog, fixedIncome))
	mux.HandleFunc("GET /fixed-income/tax-rate", handleFixedIncomeTaxRate())
	mux.HandleFunc("POST /macro-events", handleTriggerMacroEvent(macroEvents))
	mux.HandleFunc("GET /macro-events", handleListMacroEvents(macroEventReader))
	mux.HandleFunc("GET /market/indicators/history", handleGetIndicatorHistory(indicatorHistory))
	mux.HandleFunc("GET /market/clock", handleGetMarketClock(calendar))
	mux.HandleFunc("GET /market/calendar", handleGetMarketCalendar(calendar))

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run sobe o servidor e bloqueia até ele encerrar ou falhar.
func Run(addr string, accounts accountWriter, catalog catalogReader, temporizador ticker, orders orderSubmitter, fixedIncome fixedIncomeExecutor, macroEvents macroEventTriggerer, macroEventReader macroEventLister, userData userMarketDataReader, indicatorHistory indicatorHistoryReader, calendar *CalendarAPI, opts ...Option) error {
	srv := New(addr, accounts, catalog, temporizador, orders, fixedIncome, macroEvents, macroEventReader, userData, indicatorHistory, calendar, opts...)
	log.Printf("motor de simulação escutando em %s", addr)
	return srv.ListenAndServe()
}
