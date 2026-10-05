package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain/account"
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

// TestCreditSalary_CreditaSaldoEGravaEvento cobre a tarefa T.2: crédito
// atômico de salário mensal (caixa livre, nunca capital de risco) — soma em
// current_balance sem tocar total_invested/total_disinvested/
// total_dividends_received (T.1), e grava o evento imutável salary_payment
// (com reference_month, achado 025) em market_events. Precisa do banco
// descartável porque market_events é append-only.
func TestCreditSalary_CreditaSaldoEGravaEvento(t *testing.T) {
	repo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	_, userID := seedAssetAndAccount(t, conn)

	if err := repo.CreditSalary(ctx, userID, 1000.00, "2026-01"); err != nil {
		t.Fatalf("CreditSalary: %v", err)
	}

	acc, found, err := repo.FindByUserID(ctx, userID)
	if err != nil {
		t.Fatalf("FindByUserID: %v", err)
	}
	if !found {
		t.Fatal("conta não encontrada depois do crédito")
	}
	if acc.CurrentBalance != 11000.00 {
		t.Errorf("CurrentBalance = %v, want 11000.00 (10000 default + 1000 salário)", acc.CurrentBalance)
	}
	if acc.TotalInvested != 0 || acc.TotalDisinvested != 0 || acc.TotalDividendsReceived != 0 {
		t.Errorf("acc = %+v, salário não deveria tocar total_invested/total_disinvested/total_dividends_received", acc)
	}

	var eventType string
	var unitValue float64
	var referenceMonth string
	if err := conn.QueryRowContext(ctx,
		`SELECT event_type, unit_value, reference_month FROM market_events WHERE user_id = $1 AND event_type = 'salary_payment'`, userID,
	).Scan(&eventType, &unitValue, &referenceMonth); err != nil {
		t.Fatalf("evento salary_payment não gravado: %v", err)
	}
	if unitValue != 1000.00 {
		t.Errorf("unit_value do evento = %v, want 1000.00", unitValue)
	}
	if referenceMonth != "2026-01" {
		t.Errorf("reference_month do evento = %q, want \"2026-01\"", referenceMonth)
	}
}

// TestCreditSalary_ContaNaoEncontrada cobre o critério de aceite de não
// creditar (nem gravar evento) numa conta inexistente — a transação inteira
// desfaz porque a FK de market_events só é checada no commit (DEFERRABLE
// INITIALLY DEFERRED), que nunca acontece nesse caminho.
func TestCreditSalary_ContaNaoEncontrada(t *testing.T) {
	repo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()

	err := repo.CreditSalary(ctx, "00000000-0000-4000-8000-000000000000", 1000.00, "2026-01")
	if !errors.Is(err, account.ErrNotFound) {
		t.Fatalf("err = %v, want account.ErrNotFound", err)
	}

	var count int
	if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM market_events WHERE event_type = 'salary_payment'`).Scan(&count); err != nil {
		t.Fatalf("count market_events: %v", err)
	}
	if count != 0 {
		t.Errorf("count market_events salary_payment = %d, want 0 (transação deveria desfazer o evento)", count)
	}
}

// TestAdminCredit_CreditaSaldoEGravaEvento cobre a N.17: crédito administrativo é caixa
// livre (nunca toca total_invested/total_disinvested/total_dividends_received, então não
// infla a rentabilidade) e grava o evento imutável admin_credit, distinto de
// salary_payment. Valor acima do limite da coluna vira ErrBalanceOverflow e desfaz o
// evento junto.
func TestAdminCredit_CreditaSaldoEGravaEvento(t *testing.T) {
	repo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	_, userID := seedAssetAndAccount(t, conn)

	if err := repo.AdminCredit(ctx, userID, 250000.50); err != nil {
		t.Fatalf("AdminCredit: %v", err)
	}

	acc, _, err := repo.FindByUserID(ctx, userID)
	if err != nil {
		t.Fatalf("FindByUserID: %v", err)
	}
	if acc.CurrentBalance != 260000.50 {
		t.Errorf("CurrentBalance = %v, want 260000.50", acc.CurrentBalance)
	}
	if acc.TotalInvested != 0 || acc.TotalDisinvested != 0 || acc.TotalDividendsReceived != 0 {
		t.Errorf("acc = %+v, crédito administrativo não pode tocar os totais de capital de risco", acc)
	}

	var unitValue float64
	if err := conn.QueryRowContext(ctx,
		`SELECT unit_value FROM market_events WHERE user_id = $1 AND event_type = 'admin_credit'`, userID,
	).Scan(&unitValue); err != nil {
		t.Fatalf("evento admin_credit não gravado: %v", err)
	}
	if unitValue != 250000.50 {
		t.Errorf("unit_value do evento = %v, want 250000.50", unitValue)
	}
}

func TestAdminCredit_ContaInexistenteEEstouroDesfazemOEvento(t *testing.T) {
	repo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	_, userID := seedAssetAndAccount(t, conn)

	if err := repo.AdminCredit(ctx, "00000000-0000-4000-8000-000000000000", 100); !errors.Is(err, account.ErrNotFound) {
		t.Fatalf("conta inexistente: err = %v, want account.ErrNotFound", err)
	}
	if err := repo.AdminCredit(ctx, userID, 9_999_999_999_999.99); !errors.Is(err, account.ErrBalanceOverflow) {
		t.Fatalf("estouro: err = %v, want account.ErrBalanceOverflow", err)
	}

	var count int
	if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM market_events WHERE event_type = 'admin_credit'`).Scan(&count); err != nil {
		t.Fatalf("count market_events: %v", err)
	}
	if count != 0 {
		t.Errorf("eventos admin_credit = %d, want 0 (as duas falhas desfazem a transação)", count)
	}
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
