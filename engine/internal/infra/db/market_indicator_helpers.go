package db

import (
	"context"
	"database/sql"
	"errors"
)

// currentSelicRatePct lê a Selic simulada corrente (market_calendar,
// linha singleton, tarefa 3.11) — reaproveitada por CatalogRepository
// (reprecificar a taxa ofertada pro Prefixado/IPCA+ exibida, tarefa L.4) e
// FixedIncomeExecutionRepository (mesma reprecificação na compra, e a
// marcação a mercado no resgate, já existente desde a 3.13). ok = false
// (sem erro) quando o Temporizador ainda não rodou nenhum tick — quem
// chama decide se isso é uma falha (compra/resgate, que já tratam essa
// falta de precondição via ErrMarketCalendarNotInitialized) ou um dado
// opcional pra exibição (catálogo, que cai de volta pro spread cru).
func currentSelicRatePct(ctx context.Context, db *sql.DB) (float64, bool, error) {
	var rate float64
	err := db.QueryRowContext(ctx, `SELECT selic_rate FROM market_calendar WHERE id = 1`).Scan(&rate)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return rate, true, nil
}

// currentIPCAAccumulated12m lê o IPCA acumulado em 12 meses simulados mais
// recente (market_indicator_history, tarefa M.1 — decimal, ex: 0.03 = 3%),
// mesmo raciocínio de currentSelicRatePct: reaproveita o histórico já
// persistido e exibido ao usuário (M.4) em vez de recalcular uma
// aproximação paralela por relógio de parede — o valor que embasa a
// correção de Fisher (fixedincome.FisherRealRate, tarefa L.4) é exatamente
// o mesmo que a tela de indicadores mostra.
func currentIPCAAccumulated12m(ctx context.Context, db *sql.DB) (float64, bool, error) {
	var v float64
	err := db.QueryRowContext(ctx,
		`SELECT ipca_accumulated_12m FROM market_indicator_history ORDER BY simulated_day DESC LIMIT 1`,
	).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return v, true, nil
}
