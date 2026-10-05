package db

import (
	"context"
	"database/sql"
	"time"

	"tcc-investimentos/engine/internal/domain/marketcalendar"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// CalendarRepository lê os fatos que a linha do tempo da simulação mostra
// (tarefa S.10): implementa marketcalendar.GlobalFacts e marketcalendar.UserFacts.
// Só leitura; nenhum fato daqui é escrita de saldo/posição. Ativos sandbox ficam
// de fora de tudo (o roteiro do Modo Aprendizado não é mercado real, S.8).
type CalendarRepository struct {
	db *sql.DB
}

func NewCalendarRepository(db *sql.DB) *CalendarRepository {
	return &CalendarRepository{db: db}
}

func (r *CalendarRepository) CurrentDay(ctx context.Context) (int, error) {
	return loadSimulatedDay(ctx, r.db)
}

func (r *CalendarRepository) MacroEventsBetween(ctx context.Context, fromDay, toDay int) ([]marketcalendar.MacroEventFact, error) {
	rows, err := r.db.QueryContext(ctx,
		// Calendário do usuário: só o que macroevent.IsPubliclyVisible permite (cancelado
		// nunca, agendado só a partir da véspera), senão título e direção de um evento
		// agendado apareceriam com semanas de aviso (tarefa N.11).
		`SELECT triggered_on_day, title, direction FROM macro_events
		 WHERE triggered_on_day BETWEEN $1 AND $2
		   AND status <> 'cancelado'
		   AND triggered_on_day <= (SELECT current_day FROM market_calendar WHERE id = 1) + 1
		 ORDER BY triggered_on_day, created_at`, fromDay, toDay)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	facts := make([]marketcalendar.MacroEventFact, 0)
	for rows.Next() {
		var f marketcalendar.MacroEventFact
		if err := rows.Scan(&f.Day, &f.Title, &f.Direction); err != nil {
			return nil, err
		}
		facts = append(facts, f)
	}
	return facts, rows.Err()
}

func (r *CalendarRepository) SelicByDay(ctx context.Context, fromDay, toDay int) (map[int]float64, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT simulated_day, selic_rate FROM market_indicator_history WHERE simulated_day BETWEEN $1 AND $2`, fromDay, toDay)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	rates := make(map[int]float64)
	for rows.Next() {
		var day int
		var rate float64
		if err := rows.Scan(&day, &rate); err != nil {
			return nil, err
		}
		rates[day] = rate
	}
	return rates, rows.Err()
}

func (r *CalendarRepository) DividendsBetween(ctx context.Context, fromDay, toDay int) ([]marketcalendar.DividendFact, error) {
	from, to := simcalendar.DateOf(fromDay), simcalendar.DateOf(toDay)
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.ticker, d.value_per_share, d.ex_date, d.payment_date
		 FROM dividend_events d JOIN assets a ON a.id = d.asset_id
		 WHERE a.is_sandbox = false
		   AND ((d.ex_date BETWEEN $1 AND $2) OR (d.payment_date BETWEEN $1 AND $2))
		 ORDER BY d.payment_date, a.ticker`, from, to)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	facts := make([]marketcalendar.DividendFact, 0)
	for rows.Next() {
		var f marketcalendar.DividendFact
		var ex, pay time.Time
		if err := rows.Scan(&f.Ticker, &f.ValuePerShare, &ex, &pay); err != nil {
			return nil, err
		}
		f.ExDay, f.PaymentDay = simcalendar.DayOf(ex), simcalendar.DayOf(pay)
		facts = append(facts, f)
	}
	return facts, rows.Err()
}

// UserFactsBetween junta os eventos do próprio usuário (market_events, no dia
// simulado em que aconteceram) e os vencimentos de renda fixa que ele ainda carrega.
func (r *CalendarRepository) UserFactsBetween(ctx context.Context, userID string, fromDay, toDay int) ([]marketcalendar.UserFact, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT e.simulated_day, e.event_type, a.ticker, e.quantity, e.unit_value, e.reference_month
		 FROM market_events e LEFT JOIN assets a ON a.id = e.asset_id
		 WHERE e.user_id = $1 AND (a.is_sandbox = false OR a.id IS NULL) AND e.simulated_day BETWEEN $2 AND $3
		   AND e.event_type IN ('buy_order_executed', 'sell_order_executed', 'dividend_payment',
		                        'fixed_income_purchase', 'fixed_income_redemption', 'salary_payment')
		 ORDER BY e.simulated_day, e."timestamp", e.id`, userID, fromDay, toDay)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	facts := make([]marketcalendar.UserFact, 0)
	for rows.Next() {
		var f marketcalendar.UserFact
		var ticker sql.NullString
		var quantity sql.NullFloat64
		var unitValue sql.NullFloat64
		var referenceMonth sql.NullString
		if err := rows.Scan(&f.Day, &f.EventType, &ticker, &quantity, &unitValue, &referenceMonth); err != nil {
			return nil, err
		}
		if ticker.Valid {
			f.Ticker = ticker.String
		}
		if quantity.Valid {
			f.Quantity = &quantity.Float64
		}
		if unitValue.Valid {
			f.UnitValue = &unitValue.Float64
		}
		if referenceMonth.Valid {
			f.ReferenceMonth = referenceMonth.String
		}
		facts = append(facts, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	maturities, err := r.db.QueryContext(ctx,
		`SELECT a.ticker, fa.maturity_date, p.quantity
		 FROM fixed_income_positions p
		   JOIN fixed_income_assets fa ON fa.asset_id = p.asset_id
		   JOIN assets a ON a.id = p.asset_id
		 WHERE p.user_id = $1 AND p.quantity > 0 AND a.is_sandbox = false
		   AND fa.maturity_date >= $2 AND fa.maturity_date < $3
		 ORDER BY fa.maturity_date, a.ticker`,
		userID, simcalendar.DateOf(fromDay), simcalendar.DateOf(toDay+1))
	if err != nil {
		return nil, err
	}
	defer func() { _ = maturities.Close() }()
	for maturities.Next() {
		var ticker string
		var maturity time.Time
		var quantity float64
		if err := maturities.Scan(&ticker, &maturity, &quantity); err != nil {
			return nil, err
		}
		facts = append(facts, marketcalendar.UserFact{Day: simcalendar.DayOf(maturity.UTC()), Ticker: ticker, Quantity: &quantity, Maturity: true})
	}
	return facts, maturities.Err()
}
