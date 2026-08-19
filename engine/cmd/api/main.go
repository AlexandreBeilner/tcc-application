// Command api é o ponto de entrada do motor de simulação.
package main

import (
	"log"
	"os"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/infra/db"
	"tcc-investimentos/engine/internal/infra/httpserver"
)

func main() {
	addr := os.Getenv("ENGINE_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Sem DATABASE_URL, o motor sobe só com /health — POST /accounts
		// responde 503 (ver internal/infra/httpserver/account.go).
		if err := httpserver.Run(addr, nil); err != nil {
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

	if err := httpserver.Run(addr, accountService); err != nil {
		log.Fatalf("motor de simulação encerrou com erro: %v", err)
	}
}
