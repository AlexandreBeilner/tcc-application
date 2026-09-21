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
// /accounts responde 503 nesse caso; catalog, temporizador, orders,
// fixedIncome, macroEvents, macroEventReader, userData e indicatorHistory
// podem ser nil também — GET /assets, /assets/:id, /assets/:id/quotes,
// /companies/:id, POST /admin/tick, POST /orders, POST /orders/:id/cancel,
// POST /fixed-income/purchases|redemptions, GET /fixed-income/simulate, POST
// /macro-events, GET /macro-events, GET /accounts/:user_id[/events], GET
// /positions, GET /fixed-income/positions e GET
// /market/indicators/history respondem 503 nesse caso, em vez de panicar.
func New(addr string, accounts accountOpener, catalog catalogReader, temporizador ticker, orders orderSubmitter, fixedIncome fixedIncomeExecutor, macroEvents macroEventTriggerer, macroEventReader macroEventLister, userData userMarketDataReader, indicatorHistory indicatorHistoryReader) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /accounts", handleCreateAccount(accounts))
	mux.HandleFunc("GET /accounts/{user_id}", handleGetAccount(userData))
	mux.HandleFunc("GET /accounts/{user_id}/events", handleListAccountEvents(userData))
	mux.HandleFunc("GET /positions", handleListPositions(userData))
	mux.HandleFunc("GET /fixed-income/positions", handleListFixedIncomePositions(userData))
	mux.HandleFunc("GET /assets", handleListAssets(catalog))
	mux.HandleFunc("GET /assets/{id}", handleGetAsset(catalog))
	mux.HandleFunc("GET /assets/{id}/quotes", handleGetAssetQuoteHistory(catalog))
	mux.HandleFunc("GET /companies/{id}", handleGetCompany(catalog))
	mux.HandleFunc("POST /admin/tick", handleAdminTick(temporizador))
	mux.HandleFunc("POST /orders", handleSubmitOrder(catalog, orders))
	mux.HandleFunc("POST /orders/{id}/cancel", handleCancelOrder(orders))
	mux.HandleFunc("POST /fixed-income/purchases", handleFixedIncomePurchase(catalog, fixedIncome))
	mux.HandleFunc("POST /fixed-income/redemptions", handleFixedIncomeRedemption(catalog, fixedIncome))
	mux.HandleFunc("GET /fixed-income/simulate", handleFixedIncomeSimulate(catalog, fixedIncome))
	mux.HandleFunc("GET /fixed-income/tax-rate", handleFixedIncomeTaxRate())
	mux.HandleFunc("POST /macro-events", handleTriggerMacroEvent(macroEvents))
	mux.HandleFunc("GET /macro-events", handleListMacroEvents(macroEventReader))
	mux.HandleFunc("GET /market/indicators/history", handleGetIndicatorHistory(indicatorHistory))

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run sobe o servidor e bloqueia até ele encerrar ou falhar.
func Run(addr string, accounts accountOpener, catalog catalogReader, temporizador ticker, orders orderSubmitter, fixedIncome fixedIncomeExecutor, macroEvents macroEventTriggerer, macroEventReader macroEventLister, userData userMarketDataReader, indicatorHistory indicatorHistoryReader) error {
	srv := New(addr, accounts, catalog, temporizador, orders, fixedIncome, macroEvents, macroEventReader, userData, indicatorHistory)
	log.Printf("motor de simulação escutando em %s", addr)
	return srv.ListenAndServe()
}
