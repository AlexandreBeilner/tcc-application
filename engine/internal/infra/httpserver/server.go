// Package httpserver monta o servidor HTTP do motor de simulação e registra
// as rotas — é a camada de infraestrutura que expõe o domínio, nunca o contrário.
package httpserver

import (
	"log"
	"net/http"
	"time"
)

// New monta o *http.Server com as rotas do motor de simulação registradas.
// accounts pode ser nil (ex: sem DATABASE_URL configurado) — POST
// /accounts responde 503 nesse caso, em vez de panicar.
func New(addr string, accounts accountOpener) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /accounts", handleCreateAccount(accounts))

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run sobe o servidor e bloqueia até ele encerrar ou falhar.
func Run(addr string, accounts accountOpener) error {
	srv := New(addr, accounts)
	log.Printf("motor de simulação escutando em %s", addr)
	return srv.ListenAndServe()
}
