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
// /accounts responde 503 nesse caso; catalog pode ser nil também — GET
// /assets, /assets/:id e /companies/:id respondem 503 nesse caso, em vez
// de panicar.
func New(addr string, accounts accountOpener, catalog catalogReader) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /accounts", handleCreateAccount(accounts))
	mux.HandleFunc("GET /assets", handleListAssets(catalog))
	mux.HandleFunc("GET /assets/{id}", handleGetAsset(catalog))
	mux.HandleFunc("GET /companies/{id}", handleGetCompany(catalog))

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run sobe o servidor e bloqueia até ele encerrar ou falhar.
func Run(addr string, accounts accountOpener, catalog catalogReader) error {
	srv := New(addr, accounts, catalog)
	log.Printf("motor de simulação escutando em %s", addr)
	return srv.ListenAndServe()
}
