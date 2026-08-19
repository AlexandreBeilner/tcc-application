// Package httpserver monta o servidor HTTP do motor de simulação e registra
// as rotas — é a camada de infraestrutura que expõe o domínio, nunca o contrário.
package httpserver

import (
	"log"
	"net/http"
	"time"
)

// New monta o *http.Server com as rotas do motor de simulação registradas.
func New(addr string) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run sobe o servidor e bloqueia até ele encerrar ou falhar.
func Run(addr string) error {
	srv := New(addr)
	log.Printf("motor de simulação escutando em %s", addr)
	return srv.ListenAndServe()
}
