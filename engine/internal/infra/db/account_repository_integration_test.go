package db

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/lib/pq"
)

// openAccountRepositoryOnScratchDB abre um AccountRepository contra um banco
// Postgres real descartável, criado e destruído só pra este teste — nunca o
// `market` de desenvolvimento (mesmo cuidado de engine/scripts/
// validacao-etf-e2e.sh, que cria market_e2e/market_e2e_b em vez de rodar
// contra o banco compartilhado). market_events é append-only (migration
// prevent_market_events_mutation), então um teste que grava evento de
// provento não pode limpar depois de si num banco compartilhado — precisa
// de um banco descartável inteiro. Roda só com TEST_DATABASE_URL definida
// (aponta pra qualquer banco do mesmo cluster, só usado aqui como admin
// connection pra CREATE/DROP DATABASE), senão é pulado, mesmo padrão de
// openTwoInstances (tick_lock_integration_test.go).
func openAccountRepositoryOnScratchDB(t *testing.T) (*AccountRepository, *sql.DB) {
	t.Helper()
	baseURL := os.Getenv("TEST_DATABASE_URL")
	if baseURL == "" {
		t.Skip("TEST_DATABASE_URL não definida: teste de integração de AccountRepository pulado")
	}

	parsed, err := url.Parse(baseURL)
	if err != nil {
		t.Fatalf("parse TEST_DATABASE_URL: %v", err)
	}

	admin, err := Open(baseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = admin.Close() }()

	dbName := fmt.Sprintf("market_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(`CREATE DATABASE ` + pq.QuoteIdentifier(dbName)); err != nil {
		t.Fatalf("CREATE DATABASE %s: %v", dbName, err)
	}
	t.Cleanup(func() {
		admin2, err := Open(baseURL)
		if err != nil {
			return
		}
		defer func() { _ = admin2.Close() }()
		_, _ = admin2.Exec(`DROP DATABASE IF EXISTS ` + pq.QuoteIdentifier(dbName))
	})

	scratchURL := *parsed
	scratchURL.Path = "/" + dbName
	scratchDSN := scratchURL.String()

	if err := Migrate(scratchDSN); err != nil {
		t.Fatalf("aplicar migrations no banco descartável: %v", err)
	}

	conn, err := Open(scratchDSN)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })

	return NewAccountRepository(conn), conn
}

// seedAssetAndAccount cria um ativo (ação) e uma conta com R$ 10.000 (default
// da migration) no banco descartável do teste, devolvendo os dois UUIDs
// gerados pelo Postgres.
func seedAssetAndAccount(t *testing.T, conn *sql.DB) (assetID, userID string) {
	t.Helper()
	ctx := context.Background()

	if err := conn.QueryRowContext(ctx,
		`INSERT INTO assets (ticker, name, type) VALUES ('VALS15', 'Vale ON', 'acao') RETURNING id`,
	).Scan(&assetID); err != nil {
		t.Fatalf("seed asset: %v", err)
	}
	if err := conn.QueryRowContext(ctx,
		`INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`,
	).Scan(&userID); err != nil {
		t.Fatalf("seed account: %v", err)
	}

	return assetID, userID
}

// TestListPositionsByUser_DividendsReceived cobre a tarefa S.15: o motor
// agrega dividends_received por ativo a partir dos eventos dividend_payment
// em market_events (payDueDividends, tick_repository.go), sem precisar de
// coluna nova. Contra Postgres real porque a agregação é feita em SQL
// (LEFT JOIN + SUM), não em Go.
func TestListPositionsByUser_DividendsReceived(t *testing.T) {
	repo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	assetID, userID := seedAssetAndAccount(t, conn)

	if _, err := conn.ExecContext(ctx,
		`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 10, 100.00)`,
		userID, assetID,
	); err != nil {
		t.Fatalf("seed position: %v", err)
	}

	// Dois ciclos de provento (tarefa S.15 pede "2+ ciclos" no critério de
	// aceite): 10 ações * R$1,20 + 10 ações * R$0,80 = R$20,00.
	for _, unitValue := range []float64{1.20, 0.80} {
		if _, err := conn.ExecContext(ctx,
			`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'dividend_payment', 10, $3)`,
			userID, assetID, unitValue,
		); err != nil {
			t.Fatalf("seed dividend event: %v", err)
		}
	}

	records, err := repo.ListPositionsByUser(ctx, userID)
	if err != nil {
		t.Fatalf("ListPositionsByUser: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("len(records) = %d, want 1", len(records))
	}
	if got, want := records[0].DividendsReceived, 20.0; got != want {
		t.Errorf("DividendsReceived = %v, want %v", got, want)
	}
}

// TestListPositionsByUser_SemProvento cobre o outro lado do critério de
// aceite: posição sem provento nenhum devolve 0 (COALESCE), não NULL.
func TestListPositionsByUser_SemProvento(t *testing.T) {
	repo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	assetID, userID := seedAssetAndAccount(t, conn)

	if _, err := conn.ExecContext(ctx,
		`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 5, 50.00)`,
		userID, assetID,
	); err != nil {
		t.Fatalf("seed position: %v", err)
	}

	records, err := repo.ListPositionsByUser(ctx, userID)
	if err != nil {
		t.Fatalf("ListPositionsByUser: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("len(records) = %d, want 1", len(records))
	}
	if records[0].DividendsReceived != 0 {
		t.Errorf("DividendsReceived = %v, want 0", records[0].DividendsReceived)
	}
}
