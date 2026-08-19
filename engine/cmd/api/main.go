// Command api é o ponto de entrada do motor de simulação.
package main

import (
	"log"
	"os"

	"tcc-investimentos/engine/internal/infra/db"
	"tcc-investimentos/engine/internal/infra/httpserver"
)

func main() {
	addr := os.Getenv("ENGINE_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		if err := db.Migrate(databaseURL); err != nil {
			log.Fatalf("erro ao aplicar migrations: %v", err)
		}
		log.Print("migrations do banco market aplicadas")
	}

	if err := httpserver.Run(addr); err != nil {
		log.Fatalf("motor de simulação encerrou com erro: %v", err)
	}
}
