package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/adminview"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// Cobre a consulta e o cancelamento por intervenção de ordens (N.10) contra um
// Postgres real descartável (roda só com TEST_DATABASE_URL).
func TestAdminOrders_ConsultaECancelamentoPorIntervencao(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	scan := func(dest *string, query string, args ...any) {
		t.Helper()
		if err := conn.QueryRowContext(ctx, query, args...).Scan(dest); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	var bot, user, acme, other string
	scan(&bot, `INSERT INTO accounts (user_id, is_bot) VALUES (gen_random_uuid(), true) RETURNING user_id`)
	scan(&user, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&acme, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`)
	scan(&other, `INSERT INTO assets (ticker, name, type) VALUES ('OTHR3', 'Other', 'acao') RETURNING id`)
	if _, err := conn.ExecContext(ctx, `INSERT INTO bot_personalities (account_id, archetype, within_scope_pct, max_position_size_pct, market_order_preference, spread_width_pct, max_covered_assets)
	      VALUES ($1, 'market_maker', 1, 0.1, 0, 0.02, 10)`, bot); err != nil {
		t.Fatal(err)
	}
	insert := func(asset, owner, side, status string) string {
		var id string
		scan(&id, `INSERT INTO order_book (asset_id, user_id, type, side, quantity, price, status) VALUES ($1, $2, 'limit', $3, 100, 10, $4) RETURNING id`, asset, owner, side, status)
		return id
	}
	userBuy := insert(acme, user, "buy", "pending")
	botSell := insert(acme, bot, "sell", "partially_filled")
	botBuyOther := insert(other, bot, "buy", "pending")
	done := insert(acme, user, "sell", "filled")

	reads := NewAdminReadRepository(conn)
	orders := NewOrderExecutionRepository(conn, nil)

	t.Run("lista com atalho open, dono e arquétipo", func(t *testing.T) {
		rows, total, err := reads.AdminOrders(ctx, adminview.OrderFilter{AssetID: acme, Status: "open"})
		if err != nil {
			t.Fatal(err)
		}
		if total != 2 || len(rows) != 2 {
			t.Fatalf("total=%d len=%d, want 2 ordens abertas de ACME3", total, len(rows))
		}
		var sawBot bool
		for _, r := range rows {
			if r.OrderID == botSell && r.IsBot && r.Archetype != nil && *r.Archetype == "market_maker" && r.Ticker == "ACME3" {
				sawBot = true
			}
		}
		if !sawBot {
			t.Errorf("ordem do bot não veio identificada: %+v", rows)
		}
	})

	t.Run("pagina com total", func(t *testing.T) {
		rows, total, err := reads.AdminOrders(ctx, adminview.OrderFilter{Limit: 2})
		if err != nil || len(rows) != 2 || total != 4 {
			t.Fatalf("len=%d total=%d err=%v, want 2 de 4", len(rows), total, err)
		}
	})

	t.Run("cancela uma ordem de usuário com motivo admin", func(t *testing.T) {
		if err := orders.AdminCancelOrder(ctx, userBuy); err != nil {
			t.Fatal(err)
		}
		var status, reason string
		scan(&status, `SELECT status::text FROM order_book WHERE id = $1`, userBuy)
		scan(&reason, `SELECT cancel_reason::text FROM order_book WHERE id = $1`, userBuy)
		if status != "cancelled" || reason != "admin" {
			t.Errorf("status=%s reason=%s, want cancelled/admin", status, reason)
		}
	})

	t.Run("recusa ordem já cancelada, executada e inexistente", func(t *testing.T) {
		if err := orders.AdminCancelOrder(ctx, userBuy); !errors.Is(err, orderexecution.ErrOrderNotCancellable) {
			t.Errorf("já cancelada = %v, want ErrOrderNotCancellable", err)
		}
		if err := orders.AdminCancelOrder(ctx, done); !errors.Is(err, orderexecution.ErrOrderNotCancellable) {
			t.Errorf("executada = %v, want ErrOrderNotCancellable", err)
		}
		if err := orders.AdminCancelOrder(ctx, "00000000-0000-4000-8000-000000000000"); !errors.Is(err, orderexecution.ErrOrderNotFound) {
			t.Errorf("inexistente = %v, want ErrOrderNotFound", err)
		}
	})

	t.Run("lote acima do teto não cancela nada", func(t *testing.T) {
		_, err := orders.AdminCancelBatch(ctx, orderexecution.CancelFilter{UserID: bot}, 1)
		var tooLarge *orderexecution.BatchTooLargeError
		if !errors.As(err, &tooLarge) || tooLarge.Max != 1 {
			t.Fatalf("err = %v, want BatchTooLargeError", err)
		}
		var open string
		scan(&open, `SELECT COUNT(*)::text FROM order_book WHERE user_id = $1 AND status IN ('pending','partially_filled')`, bot)
		if open != "2" {
			t.Errorf("ordens abertas do bot = %s, want 2 intactas", open)
		}
	})

	t.Run("lote por dono e ativo cancela só a interseção", func(t *testing.T) {
		ids, err := orders.AdminCancelBatch(ctx, orderexecution.CancelFilter{UserID: bot, AssetID: acme}, 10)
		if err != nil {
			t.Fatal(err)
		}
		if len(ids) != 1 || ids[0] != botSell {
			t.Fatalf("ids = %v, want só %s", ids, botSell)
		}
		var status string
		scan(&status, `SELECT status::text FROM order_book WHERE id = $1`, botBuyOther)
		if status != "pending" {
			t.Errorf("ordem de outro ativo = %s, want pending", status)
		}
	})

	t.Run("lote sem nada em repouso devolve lista vazia", func(t *testing.T) {
		ids, err := orders.AdminCancelBatch(ctx, orderexecution.CancelFilter{AssetID: acme}, 10)
		if err != nil || len(ids) != 0 {
			t.Errorf("ids=%v err=%v, want vazio", ids, err)
		}
	})
}
