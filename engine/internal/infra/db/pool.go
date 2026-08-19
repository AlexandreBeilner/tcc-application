package db

import (
	"database/sql"

	_ "github.com/lib/pq"
)

// Open abre um pool de conexões com o banco "market". A conexão real só
// acontece no primeiro uso (database/sql é lazy).
func Open(databaseURL string) (*sql.DB, error) {
	return sql.Open("postgres", databaseURL)
}
