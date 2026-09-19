package db

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/tick"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// TickRepository implementa tick.Repository contra o banco "market" —
// market_calendar (linha singleton) e asset_quotes (tarefa 3.11).
type TickRepository struct {
	db    *sql.DB
	cache quoteCache
}

// NewTickRepository recebe cache já resolvido pelo chamador — mesma
// decisão de NewCatalogRepository (nunca nil, sempre um valor concreto:
// RedisQuoteCache ou NoopQuoteCache).
func NewTickRepository(db *sql.DB, cache quoteCache) *TickRepository {
	return &TickRepository{db: db, cache: cache}
}

// LoadState lê a linha singleton de market_calendar — found = false se o
// Temporizador nunca rodou (motor recém-subido, tabela ainda vazia).
func (r *TickRepository) LoadState(ctx context.Context) (tick.State, bool, error) {
	var state tick.State
	err := r.db.QueryRowContext(ctx,
		`SELECT current_day, selic_rate FROM market_calendar WHERE id = 1`,
	).Scan(&state.Day, &state.SelicRate)
	if err == sql.ErrNoRows {
		return tick.State{}, false, nil
	}
	if err != nil {
		return tick.State{}, false, err
	}
	return state, true, nil
}

// ListPricingAssets devolve todo ativo de renda variável ativo (is_sandbox
// = false, type em acao/etf/fii) com sua última cotação conhecida, via
// LEFT JOIN LATERAL — price fica nil quando o ativo nunca teve tick gerado
// (Advance aplica tick.DefaultInitialPrice nesse caso). Sector (setor da
// empresa emissora, via companies, tarefa 4.5) fica nil pra ETF/FII, sem
// CompanyID — usado por Advance pra resolver o fan-out de um evento macro
// de alvo setorial.
func (r *TickRepository) ListPricingAssets(ctx context.Context) ([]tick.AssetForPricing, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.type, a.risk_class, q.price, via.company_id, co.sector
		 FROM assets a
		 LEFT JOIN LATERAL (
		   SELECT price FROM asset_quotes
		   WHERE asset_id = a.id
		   ORDER BY simulated_day DESC
		   LIMIT 1
		 ) q ON true
		 LEFT JOIN variable_income_assets via ON via.asset_id = a.id
		 LEFT JOIN companies co ON co.id = via.company_id
		 WHERE a.is_sandbox = false AND a.type IN ('acao', 'etf', 'fii')
		 ORDER BY a.ticker`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var assets []tick.AssetForPricing
	for rows.Next() {
		var a tick.AssetForPricing
		if err := rows.Scan(&a.AssetID, &a.Type, &a.RiskClass, &a.LastPrice, &a.CompanyID, &a.Sector); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

// RecentClosingPrices lê os últimos `days` fechamentos diários
// (asset_quotes) de assetID, em ordem cronológica (mais antigo primeiro) —
// insumo do arquétipo Chartista (Fase D.2, tick.ChartistPriceHistoryDays).
// Devolve menos de `days` preços (ou nenhum) sem erro quando o ativo ainda
// não acumulou histórico suficiente — mesmo tratamento de "dado insuficiente
// não é erro" já dado ao restante do motor (ver
// bot.ErrInsufficientPriceHistory, consumido por quem chama).
func (r *TickRepository) RecentClosingPrices(ctx context.Context, assetID string, days int) ([]float64, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT price FROM (
		   SELECT price, simulated_day FROM asset_quotes
		   WHERE asset_id = $1
		   ORDER BY simulated_day DESC
		   LIMIT $2
		 ) recent
		 ORDER BY simulated_day ASC`,
		assetID, days,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var prices []float64
	for rows.Next() {
		var price float64
		if err := rows.Scan(&price); err != nil {
			return nil, err
		}
		prices = append(prices, price)
	}
	return prices, rows.Err()
}

// RecentTradedVolume lê o `total_quantity` (achado 005 parte B) dos
// últimos `days` dias simulados (asset_quotes) de assetID, em ordem
// cronológica (mais antigo primeiro) — insumo do teto de tamanho de ordem
// por volume médio recente (tick.effectiveOrderSizeCeiling, rounds.go).
// Mesmo contrato de RecentClosingPrices: devolve menos de `days` valores
// (ou nenhum) sem erro quando o ativo ainda não acumulou histórico
// suficiente. `total_quantity IS NOT NULL` exclui dia simulado anterior à
// migration 000017 (coluna nullable, sem DEFAULT, de propósito — ver
// comentário da migration): sem esse filtro, um ativo já em produção antes
// desta correção teria dias "zerados por desconhecimento" contados como
// "volume real zero", zerando o teto de tamanho de ordem pra sempre (achado
// do teste de ponta a ponta desta correção) em vez de cair pro float
// sozinho, como um ativo novo sem histórico nenhum.
func (r *TickRepository) RecentTradedVolume(ctx context.Context, assetID string, days int) ([]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT total_quantity FROM (
		   SELECT total_quantity, simulated_day FROM asset_quotes
		   WHERE asset_id = $1 AND total_quantity IS NOT NULL
		   ORDER BY simulated_day DESC
		   LIMIT $2
		 ) recent
		 ORDER BY simulated_day ASC`,
		assetID, days,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var volumes []int
	for rows.Next() {
		var quantity int
		if err := rows.Scan(&quantity); err != nil {
			return nil, err
		}
		volumes = append(volumes, quantity)
	}
	return volumes, rows.Err()
}

// ListCompaniesForFundamentals devolve toda empresa cadastrada com sua
// última net_revenue conhecida (company_fundamentals, via LEFT JOIN LATERAL
// ordenado por period_date), usado por Advance (tarefa 3.14) pra decidir o
// dia de relatório de cada empresa e encadear a receita a partir do último
// ciclo persistido — LastRevenue fica nil se a empresa nunca teve um ciclo
// de relatório gerado (Advance aplica fundamentals.DefaultBaseRevenue nesse
// caso).
func (r *TickRepository) ListCompaniesForFundamentals(ctx context.Context) ([]tick.CompanyForFundamentals, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT c.id, c.report_frequency_days, c.sector, f.net_revenue
		 FROM companies c
		 LEFT JOIN LATERAL (
		   SELECT net_revenue FROM company_fundamentals
		   WHERE company_id = c.id
		   ORDER BY period_date DESC, created_at DESC
		   LIMIT 1
		 ) f ON true
		 ORDER BY c.name`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var companies []tick.CompanyForFundamentals
	for rows.Next() {
		var c tick.CompanyForFundamentals
		if err := rows.Scan(&c.CompanyID, &c.ReportFrequencyDays, &c.Sector, &c.LastRevenue); err != nil {
			return nil, err
		}
		companies = append(companies, c)
	}
	return companies, rows.Err()
}

// ListPendingMacroEvents devolve todo evento macro com status = 'pendente'
// (macroevent.StatusPendente), com seus alvos (macro_event_targets) —
// usado por Advance (tarefa 4.5) pra aplicar o efeito de preço/fundamentos
// a cada tick. Um evento sem nenhum target não deveria existir
// (macroevent.NewEvent exige pelo menos um), mas o INNER JOIN reflete
// exatamente essa garantia: nenhuma linha de macro_events sem
// macro_event_targets correspondente aparece aqui. t.direction/
// t.price_effect_pct (tarefa E.1/E.2) só vêm preenchidos quando o próprio
// alvo declarou direção própria — nil no caso comum, consumido por
// tick.macroPriceEffectsByCompany como "este alvo herda o efeito do
// evento" (ev.price_effect_pct, colunas 6-8 desta mesma query).
func (r *TickRepository) ListPendingMacroEvents(ctx context.Context) ([]tick.MacroEventForApplication, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT e.id, e.triggered_on_day, e.duration_days, e.affects_price, e.affects_fundamentals,
		        e.price_effect_pct, e.fundamentals_effect_pct, e.fundamentals_report_day,
		        t.sector, t.risk_class, t.asset_id, t.direction, t.price_effect_pct
		 FROM macro_events e
		 JOIN macro_event_targets t ON t.macro_event_id = e.id
		 WHERE e.status = 'pendente'
		 ORDER BY e.triggered_on_day, e.id`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	byID := make(map[string]*tick.MacroEventForApplication)
	var order []string
	for rows.Next() {
		var id string
		var target tick.MacroEventTargetForApplication
		ev := tick.MacroEventForApplication{}
		if err := rows.Scan(
			&id, &ev.TriggeredOnDay, &ev.DurationDays, &ev.AffectsPrice, &ev.AffectsFundamentals,
			&ev.PriceEffectPct, &ev.FundamentalsEffectPct, &ev.FundamentalsReportDay,
			&target.Sector, &target.RiskClass, &target.AssetID, &target.Direction, &target.PriceEffectPct,
		); err != nil {
			return nil, err
		}

		existing, seen := byID[id]
		if !seen {
			ev.ID = id
			byID[id] = &ev
			existing = &ev
			order = append(order, id)
		}
		existing.Targets = append(existing.Targets, target)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	events := make([]tick.MacroEventForApplication, 0, len(order))
	for _, id := range order {
		events = append(events, *byID[id])
	}
	return events, nil
}

// ListDividendPayerAssets devolve todo ativo pagador de provento (ação ou
// FII, is_sandbox = false) do catálogo, com a posição de cada usuário
// nesse ativo (positions, quantity > 0) — usado por Advance (tarefa 4.9)
// pra decidir o valor por ação/cota do ciclo e o snapshot de elegibilidade
// (posição na data ex) de um novo dividend_events, e (tarefas G.2/G.3) pra
// reavaliar NetWorth/PortfolioValue no mesmo calendário — indexador só vem
// preenchido pro perfil papel (G.3). ETF nunca aparece aqui — não é
// pagador de provento nesta fase (só ação e FII, RF21/lição 2.7).
func (r *TickRepository) ListDividendPayerAssets(ctx context.Context) ([]tick.DividendPayerAsset, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.type, via.company_id, via.outstanding_shares, fd.net_worth, fd.portfolio_value, fd.indexador
		 FROM assets a
		 JOIN variable_income_assets via ON via.asset_id = a.id
		 LEFT JOIN fii_details fd ON fd.asset_id = a.id
		 WHERE a.is_sandbox = false AND a.type IN ('acao', 'fii')
		 ORDER BY a.ticker`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	assetIDs := make([]string, 0)
	byID := make(map[string]*tick.DividendPayerAsset)
	for rows.Next() {
		var a tick.DividendPayerAsset
		var assetType string
		if err := rows.Scan(&a.AssetID, &assetType, &a.CompanyID, &a.OutstandingShares, &a.NetWorth, &a.PortfolioValue, &a.Indexador); err != nil {
			return nil, err
		}
		a.Type = assetType
		byID[a.AssetID] = &a
		assetIDs = append(assetIDs, a.AssetID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(assetIDs) == 0 {
		return nil, nil
	}

	holderRows, err := r.db.QueryContext(ctx,
		`SELECT asset_id, user_id, quantity FROM positions WHERE asset_id = ANY($1) AND quantity > 0`,
		pq.Array(assetIDs),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = holderRows.Close() }()

	for holderRows.Next() {
		var assetID string
		var holder tick.PositionHolder
		if err := holderRows.Scan(&assetID, &holder.UserID, &holder.Quantity); err != nil {
			return nil, err
		}
		byID[assetID].Holders = append(byID[assetID].Holders, holder)
	}
	if err := holderRows.Err(); err != nil {
		return nil, err
	}

	assets := make([]tick.DividendPayerAsset, 0, len(assetIDs))
	for _, id := range assetIDs {
		assets = append(assets, *byID[id])
	}
	return assets, nil
}

// ListPendingDividendPayments devolve todo dividend_events com paid =
// false, com seus Recipients (dividend_event_recipients) — usado por
// Advance (tarefa 4.9) pra decidir quais vencem no tick atual (PaymentDay
// == newDay) e creditar cada Recipient.
func (r *TickRepository) ListPendingDividendPayments(ctx context.Context) ([]tick.PendingDividendPayment, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, asset_id, value_per_share, payment_day FROM dividend_events WHERE paid = false ORDER BY payment_day`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	ids := make([]string, 0)
	byID := make(map[string]*tick.PendingDividendPayment)
	for rows.Next() {
		var p tick.PendingDividendPayment
		if err := rows.Scan(&p.ID, &p.AssetID, &p.ValuePerShare, &p.PaymentDay); err != nil {
			return nil, err
		}
		byID[p.ID] = &p
		ids = append(ids, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}

	recipientRows, err := r.db.QueryContext(ctx,
		`SELECT dividend_event_id, user_id, quantity FROM dividend_event_recipients WHERE dividend_event_id = ANY($1)`,
		pq.Array(ids),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = recipientRows.Close() }()

	for recipientRows.Next() {
		var eventID string
		var holder tick.PositionHolder
		if err := recipientRows.Scan(&eventID, &holder.UserID, &holder.Quantity); err != nil {
			return nil, err
		}
		byID[eventID].Recipients = append(byID[eventID].Recipients, holder)
	}
	if err := recipientRows.Err(); err != nil {
		return nil, err
	}

	payments := make([]tick.PendingDividendPayment, 0, len(ids))
	for _, id := range ids {
		payments = append(payments, *byID[id])
	}
	return payments, nil
}

// SaveTick grava o novo estado do calendário (upsert na linha singleton),
// as cotações geradas (Quote.Quantity vira asset_quotes.total_quantity,
// achado 005 parte B — insumo de RecentTradedVolume) e as novas linhas de
// company_fundamentals (tarefa 3.14, os 6 campos desde a tarefa 4.8), na
// mesma transação — nem
// calendário, cotações nem fundamentos são escrita de saldo/posição de
// usuário, por isso não passa por Event Sourcing (mesma distinção de
// catalog_repository.go pra dado cadastral). period_date usa o relógio
// real (time.Now()), não o dia simulado — mesma decisão já tomada pra DU
// restante de renda fixa na tarefa 3.13 (coerente com "1 tick = 1 dia
// real"). result.NetWorthUpdates (tarefa G.2)/PortfolioValueUpdates (tarefa
// G.3) são um UPDATE por item em fii_details.net_worth/portfolio_value,
// não um INSERT — diferente de company_fundamentals, não existe tabela de
// histórico pra essas reavaliações.
func (r *TickRepository) SaveTick(ctx context.Context, result tick.Result) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO market_calendar (id, current_day, selic_rate, updated_at)
		 VALUES (1, $1, $2, now())
		 ON CONFLICT (id) DO UPDATE SET
		   current_day = EXCLUDED.current_day,
		   selic_rate = EXCLUDED.selic_rate,
		   updated_at = now()`,
		result.State.Day, result.State.SelicRate,
	); err != nil {
		return err
	}

	for _, q := range result.Quotes {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO asset_quotes (asset_id, simulated_day, price, total_quantity) VALUES ($1, $2, $3, $4)`,
			q.AssetID, result.State.Day, q.Price, q.Quantity,
		); err != nil {
			return err
		}
	}

	if len(result.Fundamentals) > 0 {
		periodDate := time.Now()
		for _, f := range result.Fundamentals {
			financials := fundamentals.Financials{
				NetRevenue:      f.NetRevenue,
				NetIncome:       f.NetIncome,
				EBIT:            f.EBIT,
				NetEquity:       f.NetEquity,
				GrossDebt:       f.GrossDebt,
				CashEquivalents: f.CashEquivalents,
			}
			if err := insertCompanyFundamentals(ctx, tx, f.CompanyID, periodDate, financials); err != nil {
				return err
			}
		}
	}

	for _, id := range result.AppliedMacroEventIDs {
		if _, err := tx.ExecContext(ctx,
			`UPDATE macro_events SET status = 'aplicado' WHERE id = $1`,
			id,
		); err != nil {
			return err
		}
	}

	if err := saveNewDividends(ctx, tx, result.NewDividends); err != nil {
		return err
	}

	if err := payDueDividends(ctx, tx, result.DuePayments); err != nil {
		return err
	}

	for _, u := range result.NetWorthUpdates {
		if _, err := tx.ExecContext(ctx,
			`UPDATE fii_details SET net_worth = $1 WHERE asset_id = $2`,
			u.NetWorth, u.AssetID,
		); err != nil {
			return err
		}
	}

	for _, u := range result.PortfolioValueUpdates {
		if _, err := tx.ExecContext(ctx,
			`UPDATE fii_details SET portfolio_value = $1 WHERE asset_id = $2`,
			u.PortfolioValue, u.AssetID,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	r.refreshQuoteCache(ctx, result.Quotes)
	return nil
}

// refreshQuoteCache espelha as cotações recém-geradas neste tick no cache
// de leitura (tarefa 5.7, write-through) — só depois do Commit acima ter
// sucesso, pra nunca cachear um preço que não foi de fato persistido
// (fonte da verdade continua Postgres, CLAUDE.md). dailyChangePct é
// recalculado a partir do preço que ainda está em cache de *antes* deste
// tick (a cotação "atual" até agora) — sem nenhuma consulta a Postgres no
// caminho de escrita; cache frio (miss, ex: logo após um restart do Redis)
// grava só o preço, sem variação — se autocorrige no tick seguinte. Falha
// de cache (Redis fora do ar) só é logada, nunca interrompe o tick.
func (r *TickRepository) refreshQuoteCache(ctx context.Context, quotes []tick.Quote) {
	for _, q := range quotes {
		var dailyChangePct *float64
		if previous, found, err := r.cache.Get(ctx, q.AssetID); err == nil && found && previous.Price != 0 {
			pct := (q.Price - previous.Price) / previous.Price * 100
			dailyChangePct = &pct
		}
		if err := r.cache.Set(ctx, q.AssetID, catalog.Quote{Price: q.Price, DailyChangePct: dailyChangePct}); err != nil {
			log.Printf("cache de cotação: falha ao gravar asset_id=%s: %v", q.AssetID, err)
		}
	}
}

// saveNewDividends insere os dividend_events gerados neste tick (tarefa
// 4.9) e o snapshot de elegibilidade (dividend_event_recipients) — a
// posição de cada usuário na data ex, já resolvida por Advance a partir de
// ListDividendPayerAssets. Não passa por Event Sourcing: gerar o provento
// ainda não é crédito nenhum a ninguém, só o pagamento é (payDueDividends).
// ex_date/payment_date usam o relógio real (mesma decisão de period_date
// em company_fundamentals) — só informativas, quem de fato governa quando
// o pagamento acontece é payment_day (dia simulado, ver migration 000008).
func saveNewDividends(ctx context.Context, tx *sql.Tx, records []tick.DividendRecord) error {
	for _, rec := range records {
		exDate := time.Now()
		paymentDate := exDate.AddDate(0, 0, dividend.DefaultPaymentLagDays)

		var eventID string
		if err := tx.QueryRowContext(ctx,
			`INSERT INTO dividend_events (asset_id, value_per_share, ex_date, payment_date, payment_day)
			 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			rec.AssetID, rec.ValuePerShare, exDate, paymentDate, rec.PaymentDay,
		).Scan(&eventID); err != nil {
			return err
		}

		for _, recipient := range rec.Recipients {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO dividend_event_recipients (dividend_event_id, user_id, quantity) VALUES ($1, $2, $3)`,
				eventID, recipient.UserID, recipient.Quantity,
			); err != nil {
				return err
			}
		}
	}
	return nil
}

// payDueDividends credita current_balance/total_dividends_received de cada
// Recipient de um DuePayment (tarefa 4.9) — o evento dividend_payment é
// gravado em market_events **antes** de projetar o saldo (Event Sourcing,
// CLAUDE.md), depois o dividend_events correspondente é marcado paid =
// true, pra nunca ser reprocessado num tick futuro (mesmo padrão
// defensivo de macro_events.status = 'aplicado').
func payDueDividends(ctx context.Context, tx *sql.Tx, payments []tick.PendingDividendPayment) error {
	for _, p := range payments {
		for _, recipient := range p.Recipients {
			amount := p.ValuePerShare * float64(recipient.Quantity)

			if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
				UserID:    recipient.UserID,
				AssetID:   &p.AssetID,
				EventType: domain.EventDividendPayment,
				Quantity:  &recipient.Quantity,
				UnitValue: &p.ValuePerShare,
			}); err != nil {
				return err
			}

			if _, err := tx.ExecContext(ctx,
				`UPDATE accounts SET current_balance = current_balance + $1, total_dividends_received = total_dividends_received + $1, updated_at = now() WHERE user_id = $2`,
				amount, recipient.UserID,
			); err != nil {
				return err
			}
		}

		if _, err := tx.ExecContext(ctx, `UPDATE dividend_events SET paid = true WHERE id = $1`, p.ID); err != nil {
			return err
		}
	}
	return nil
}
