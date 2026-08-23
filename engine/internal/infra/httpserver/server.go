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

// New monta o *http.Server com as rotas do motor de simulação registradas.
// accounts pode ser nil (ex: sem DATABASE_URL configurado) — POST
// /accounts responde 503 nesse caso; catalog, temporizador, orders,
// fixedIncome, macroEvents e macroEventReader podem ser nil também — GET
// /assets, /assets/:id, /companies/:id, POST /admin/tick, POST /orders,
// POST /fixed-income/purchases|redemptions, POST /macro-events e GET
// /macro-events respondem 503 nesse caso, em vez de panicar.
func New(addr string, accounts accountOpener, catalog catalogReader, temporizador ticker, orders orderSubmitter, fixedIncome fixedIncomeExecutor, macroEvents macroEventTriggerer, macroEventReader macroEventLister) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /accounts", handleCreateAccount(accounts))
	mux.HandleFunc("GET /assets", handleListAssets(catalog))
	mux.HandleFunc("GET /assets/{id}", handleGetAsset(catalog))
	mux.HandleFunc("GET /companies/{id}", handleGetCompany(catalog))
	mux.HandleFunc("POST /admin/tick", handleAdminTick(temporizador))
	mux.HandleFunc("POST /orders", handleSubmitOrder(catalog, orders))
	mux.HandleFunc("POST /fixed-income/purchases", handleFixedIncomePurchase(catalog, fixedIncome))
	mux.HandleFunc("POST /fixed-income/redemptions", handleFixedIncomeRedemption(catalog, fixedIncome))
	mux.HandleFunc("POST /macro-events", handleTriggerMacroEvent(macroEvents))
	mux.HandleFunc("GET /macro-events", handleListMacroEvents(macroEventReader))

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run sobe o servidor e bloqueia até ele encerrar ou falhar.
func Run(addr string, accounts accountOpener, catalog catalogReader, temporizador ticker, orders orderSubmitter, fixedIncome fixedIncomeExecutor, macroEvents macroEventTriggerer, macroEventReader macroEventLister) error {
	srv := New(addr, accounts, catalog, temporizador, orders, fixedIncome, macroEvents, macroEventReader)
	log.Printf("motor de simulação escutando em %s", addr)
	return srv.ListenAndServe()
}
