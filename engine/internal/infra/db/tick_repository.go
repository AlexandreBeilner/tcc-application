package db

import (
	"context"
	"database/sql"
	"log"
	"strconv"
	"time"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/simcalendar"
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
// de alvo setorial. ShareClass (tarefa J.3) idem via.share_class, mesma
// coluna que ListDividendPayerAssets já lê (J.2).
func (r *TickRepository) ListPricingAssets(ctx context.Context) ([]tick.AssetForPricing, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.type, a.risk_class, q.price, via.company_id, co.sector, via.share_class, via.outstanding_shares
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
		if err := rows.Scan(&a.AssetID, &a.Type, &a.RiskClass, &a.LastPrice, &a.CompanyID, &a.Sector, &a.ShareClass, &a.OutstandingShares); err != nil {
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
		`SELECT c.id, c.report_frequency_days, c.sector, c.pn_dividend_premium_pct, c.payout_ratio_pct, c.base_growth_pct, c.quality_multiplier, c.report_offset_days,
		        COALESCE((SELECT schedule_cutover_day FROM market_calendar WHERE id = 1), 0), f.net_revenue,
		        c.schedule_assigned, c.dividend_policy, c.com_lag_days, c.payment_lag_days,
		        ARRAY(SELECT net_income FROM company_fundamentals
		              WHERE company_id = c.id AND net_income IS NOT NULL
		              ORDER BY period_date DESC, created_at DESC LIMIT 4),
		        EXISTS (SELECT 1 FROM positions p
		                JOIN accounts ac ON ac.user_id = p.user_id AND NOT ac.is_bot
		                JOIN variable_income_assets v ON v.asset_id = p.asset_id
		                WHERE v.company_id = c.id AND p.quantity > 0),
		        (SELECT MAX(start_day) FROM governance_decision_effects
		         WHERE company_id = c.id AND metric IN ('payout_ratio_pct', 'dividend_policy', 'pn_dividend_premium_pct') AND status IN ('scheduled', 'completed')),
		        ARRAY(SELECT cycle_index FROM governance_pending_declarations WHERE company_id = c.id AND status = 'held'),
		        ARRAY(SELECT cycle_index FROM governance_pending_declarations
		              WHERE company_id = c.id AND status = 'released' AND release_ex_day IS NOT NULL ORDER BY cycle_index),
		        ARRAY(SELECT release_ex_day FROM governance_pending_declarations
		              WHERE company_id = c.id AND status = 'released' AND release_ex_day IS NOT NULL ORDER BY cycle_index)
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
		var policy string
		var lastPayoutStart sql.NullInt64
		var heldCycles, releasedCycles, releasedEx []int64
		if err := rows.Scan(&c.CompanyID, &c.ReportFrequencyDays, &c.Sector, &c.PnDividendPremiumPct, &c.PayoutRatioPct, &c.BaseGrowthPct, &c.QualityMultiplier, &c.ReportOffsetDays, &c.ScheduleCutoverDay, &c.LastRevenue,
			&c.ScheduleAssigned, &policy, &c.ComLagDays, &c.PaymentLagDays, pq.Array(&c.PriorNetIncomes),
			&c.UserShareholders, &lastPayoutStart, pq.Array(&heldCycles), pq.Array(&releasedCycles), pq.Array(&releasedEx)); err != nil {
			return nil, err
		}
		c.DividendPolicy = catalog.DividendPolicy(policy)
		if lastPayoutStart.Valid {
			day := int(lastPayoutStart.Int64)
			c.LastPayoutStartDay = &day
		}
		c.HasHeldDeclaration = len(heldCycles) > 0
		for _, k := range heldCycles {
			c.HeldCycles = append(c.HeldCycles, int(k))
		}
		if len(releasedCycles) == len(releasedEx) && len(releasedCycles) > 0 {
			c.DeclaredExByCycle = make(map[int]int, len(releasedCycles))
			for i, k := range releasedCycles {
				c.DeclaredExByCycle[int(k)] = int(releasedEx[i])
			}
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
// preenchido pro perfil papel (G.3). ShareClass (tarefa J.2) só vem
// preenchido pra "acao" (via.share_class, "ON"/"PN") — usado por
// dividendRecordsForCycle pra separar o valor por ação de cada classe.
// ETF não aparece aqui: o provento dele nasce do caixa do fundo, não de um
// indicador do ativo, e é gerado por tick.Service (etfDividends, tarefa R.8), com
// o snapshot de cotistas de ETFFundRepository.ListShareHolders.
func (r *TickRepository) ListDividendPayerAssets(ctx context.Context) ([]tick.DividendPayerAsset, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.type, via.company_id, via.share_class, via.outstanding_shares, fd.net_worth, fd.portfolio_value, fd.indexador, fd.fii_type, fd.segment,
		        COALESCE(fd.schedule_assigned, false), COALESCE(fd.payout_business_day, 10),
		        COALESCE((SELECT schedule_cutover_day FROM market_calendar WHERE id = 1), 0)
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
		if err := rows.Scan(&a.AssetID, &assetType, &a.CompanyID, &a.ShareClass, &a.OutstandingShares, &a.NetWorth, &a.PortfolioValue, &a.Indexador, &a.FIIType, &a.Segment,
			&a.FIIScheduleAssigned, &a.FIIPayoutBusinessDay, &a.ScheduleCutoverDay); err != nil {
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

	assets := make([]tick.DividendPayerAsset, 0, len(assetIDs))
	for _, id := range assetIDs {
		assets = append(assets, *byID[id])
	}
	return assets, nil
}

// ListDividendHolders devolve a posição (quantity > 0) de cada usuário só nos ativos
// pedidos (RC.6.11), em uma consulta — o custo acompanha os ativos com data-ex hoje,
// não o tamanho do catálogo.
func (r *TickRepository) ListDividendHolders(ctx context.Context, assetIDs []string) (map[string][]tick.PositionHolder, error) {
	holders := make(map[string][]tick.PositionHolder, len(assetIDs))
	if len(assetIDs) == 0 {
		return holders, nil
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT asset_id, user_id, quantity FROM positions WHERE asset_id = ANY($1) AND quantity > 0 ORDER BY asset_id, user_id`,
		pq.Array(assetIDs),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var assetID string
		var holder tick.PositionHolder
		if err := rows.Scan(&assetID, &holder.UserID, &holder.Quantity); err != nil {
			return nil, err
		}
		holders[assetID] = append(holders[assetID], holder)
	}
	return holders, rows.Err()
}

// ListDividendsAwaitingSnapshot devolve os proventos declarados cuja data-ex chegou
// (ex_day <= day) e ainda sem snapshot de elegíveis (índice parcial da migration 000048).
func (r *TickRepository) ListDividendsAwaitingSnapshot(ctx context.Context, day int) ([]tick.DividendAwaitingSnapshot, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, asset_id FROM dividend_events WHERE recipients_snapshotted = false AND ex_day <= $1 ORDER BY ex_day, id`, day)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var awaiting []tick.DividendAwaitingSnapshot
	for rows.Next() {
		var a tick.DividendAwaitingSnapshot
		if err := rows.Scan(&a.EventID, &a.AssetID); err != nil {
			return nil, err
		}
		awaiting = append(awaiting, a)
	}
	return awaiting, rows.Err()
}

// ListPendingDividendPayments devolve todo dividend_events com paid =
// false, com seus Recipients (dividend_event_recipients) — usado por
// Advance (tarefa 4.9) pra decidir quais vencem no tick atual (PaymentDay
// == newDay) e creditar cada Recipient.
func (r *TickRepository) ListPendingDividendPayments(ctx context.Context, upToDay int) ([]tick.PendingDividendPayment, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT de.id, de.asset_id, de.value_per_share, de.payment_day, ed.fund_account_id
		 FROM dividend_events de
		 LEFT JOIN etf_details ed ON ed.asset_id = de.asset_id
		 WHERE de.paid = false AND de.recipients_snapshotted AND de.payment_day <= $1
		 ORDER BY de.payment_day`,
		upToDay,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	ids := make([]string, 0)
	byID := make(map[string]*tick.PendingDividendPayment)
	for rows.Next() {
		var p tick.PendingDividendPayment
		var fundAccountID sql.NullString
		if err := rows.Scan(&p.ID, &p.AssetID, &p.ValuePerShare, &p.PaymentDay, &fundAccountID); err != nil {
			return nil, err
		}
		p.FundAccountID = fundAccountID.String
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

// ListIndicatorHistory devolve a série histórica de
// market_indicator_history, ordenada cronologicamente e limitada aos days
// dias mais recentes — mesmo padrão de ListQuoteHistory (asset_quotes),
// usada só por GET /market/indicators/history (tarefa M.2). Lista vazia
// (não erro) se o Temporizador nunca rodou (motor recém-subido, tabela
// ainda vazia) — mesmo tratamento de "sem histórico ainda" já dado a
// ListQuoteHistory/handleListMacroEvents.
func (r *TickRepository) ListIndicatorHistory(ctx context.Context, days int) ([]tick.IndicatorHistoryEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT simulated_day, selic_rate, ipca_monthly, ipca_accumulated_12m FROM (
		   SELECT simulated_day, selic_rate, ipca_monthly, ipca_accumulated_12m FROM market_indicator_history
		   ORDER BY simulated_day DESC
		   LIMIT $1
		 ) recent ORDER BY simulated_day ASC`,
		days,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	entries := make([]tick.IndicatorHistoryEntry, 0)
	for rows.Next() {
		var e tick.IndicatorHistoryEntry
		if err := rows.Scan(&e.SimulatedDay, &e.SelicRate, &e.IPCAMonthlyRate, &e.IPCAAccumulated12m); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// SaveTick grava o novo estado do calendário (upsert na linha singleton),
// uma nova linha em market_indicator_history (tarefa M.1 — histórico
// completo de Selic/IPCA, nunca atualizada depois de gravada, diferente da
// linha singleton de market_calendar), as cotações geradas (Quote.Quantity
// vira asset_quotes.total_quantity, achado 005 parte B — insumo de
// RecentTradedVolume) e as novas linhas de
// company_fundamentals (tarefa 3.14, os 6 campos desde a tarefa 4.8), na
// mesma transação — nem
// calendário, histórico de indicador, cotações nem fundamentos são escrita
// de saldo/posição de usuário, por isso não passam por Event Sourcing
// (mesma distinção de catalog_repository.go pra dado cadastral). period_date
// é a data do dia simulado (simcalendar.DateOf, tarefa S.1), não o relógio
// de parede. result.NetWorthUpdates (tarefa G.2)/PortfolioValueUpdates
// (tarefa G.3) são um UPDATE por item em fii_details.net_worth/
// portfolio_value, não um INSERT — diferente de company_fundamentals, não
// existe tabela de histórico pra essas reavaliações.
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

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO market_indicator_history (simulated_day, selic_rate, ipca_monthly, ipca_accumulated_12m)
		 VALUES ($1, $2, $3, $4)`,
		result.State.Day, result.State.SelicRate, result.IPCAMonthlyRate, result.IPCAAccumulated12m,
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
		periodDate := simcalendar.DateOf(result.State.Day)
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

	if err := saveNewDividends(ctx, tx, result.State.Day, result.NewDividends); err != nil {
		return err
	}

	if err := saveDeclarations(ctx, tx, result); err != nil {
		return err
	}

	if err := saveDividendSnapshots(ctx, tx, result.Snapshots); err != nil {
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

	for _, n := range result.ETFNAVs {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO etf_nav_history (etf_asset_id, simulated_day, nav, close_price, premium_pct, index_value, tracking_error_pct)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			n.ETFAssetID, result.State.Day, n.NAV, n.ClosePrice, n.PremiumPct, n.IndexValue, n.TrackingErrorPct,
		); err != nil {
			return err
		}
		if err := saveETFExpenses(ctx, tx, n); err != nil {
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
// ex_date/payment_date são datas simuladas (tarefa S.1): a data ex é o dia
// simulado corrente e o pagamento cai em payment_day (o dia que de fato
// governa quando o pagamento acontece, ver migration 000008).
func saveNewDividends(ctx context.Context, tx *sql.Tx, day int, records []tick.DividendRecord) error {
	for _, rec := range records {
		exDay := day
		if rec.ExDay > 0 {
			exDay = rec.ExDay
		}
		exDate := simcalendar.DateOf(exDay)
		paymentDate := simcalendar.DateOf(rec.PaymentDay)

		var eventID string
		if err := tx.QueryRowContext(ctx,
			`INSERT INTO dividend_events (asset_id, value_per_share, ex_date, payment_date, payment_day,
			                              declared_day, ex_day, recipients_snapshotted)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
			rec.AssetID, rec.ValuePerShare, exDate, paymentDate, rec.PaymentDay, day, exDay, !rec.SnapshotPending,
		).Scan(&eventID); err != nil {
			return err
		}

		if rec.FundLiability > 0 {
			// Provento de ETF (R.8): o total vira passivo do fundo na data-ex, então o NAV
			// cai agora; o caixa só sai no pagamento.
			if _, err := tx.ExecContext(ctx,
				`UPDATE etf_details SET dividends_payable = dividends_payable + $1 WHERE asset_id = $2`,
				rec.FundLiability, rec.AssetID,
			); err != nil {
				return err
			}
		}

		if err := insertDividendRecipients(ctx, tx, eventID, rec.Recipients); err != nil {
			return err
		}
	}
	return nil
}

// insertDividendRecipients grava o snapshot de elegíveis de um evento de dividendo:
// um INSERT por evento (tarefa Q.6), não um por detentor.
func insertDividendRecipients(ctx context.Context, tx *sql.Tx, eventID string, recipients []tick.PositionHolder) error {
	if len(recipients) == 0 {
		return nil
	}
	userIDs := make([]string, len(recipients))
	quantities := make([]int64, len(recipients))
	for i, recipient := range recipients {
		userIDs[i], quantities[i] = recipient.UserID, int64(recipient.Quantity)
	}
	_, err := tx.ExecContext(ctx,
		`INSERT INTO dividend_event_recipients (dividend_event_id, user_id, quantity)
		 SELECT $1, t.u::uuid, t.q FROM unnest($2::text[], $3::int[]) AS t(u, q)`,
		eventID, pq.Array(userIDs), pq.Array(quantities),
	)
	return err
}

// saveDividendSnapshots grava os snapshots tirados na data-ex dos proventos declarados
// antes (RC.6.11) e os marca como snapshotted, na mesma transação do tick.
func saveDividendSnapshots(ctx context.Context, tx *sql.Tx, snapshots []tick.DividendSnapshot) error {
	for _, snap := range snapshots {
		if err := insertDividendRecipients(ctx, tx, snap.EventID, snap.Recipients); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE dividend_events SET recipients_snapshotted = true WHERE id = $1`, snap.EventID); err != nil {
			return err
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
		if p.FundAccountID != "" {
			if err := debitFundForPayout(ctx, tx, p); err != nil {
				return err
			}
		}
		if len(p.Recipients) > 0 {
			// Tarefa Q.6: dois comandos por dividendo pago (os eventos em lote e a
			// projeção dos saldos em lote), não dois por detentor. Os eventos
			// continuam sendo gravados ANTES de projetar o saldo (Event Sourcing).
			events := make([]domain.MarketEvent, len(p.Recipients))
			userIDs := make([]string, len(p.Recipients))
			amounts := make([]string, len(p.Recipients))
			for i := range p.Recipients {
				recipient := &p.Recipients[i]
				events[i] = domain.MarketEvent{
					UserID:    recipient.UserID,
					AssetID:   &p.AssetID,
					EventType: domain.EventDividendPayment,
					Quantity:  &recipient.Quantity,
					UnitValue: &p.ValuePerShare,
				}
				userIDs[i] = recipient.UserID
				amounts[i] = strconv.FormatFloat(p.ValuePerShare*float64(recipient.Quantity), 'f', -1, 64)
			}
			if err := eventstore.AppendBatchTx(ctx, tx, events); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx,
				`UPDATE accounts a
				 SET current_balance = a.current_balance + t.amount,
				     total_dividends_received = a.total_dividends_received + t.amount,
				     updated_at = now()
				 FROM (SELECT u::uuid AS user_id, amt::numeric AS amount
				       FROM unnest($1::text[], $2::text[]) AS x(u, amt)) t
				 WHERE a.user_id = t.user_id`,
				pq.Array(userIDs), pq.Array(amounts),
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

// debitFundForPayout tira do caixa do fundo o que um provento de ETF paga aos
// cotistas e quita o passivo criado na data-ex (tarefa R.8). O evento
// etf_dividend_payout é gravado antes de projetar o saldo (Event Sourcing); o total
// é o mesmo (em centavos exatos) que os cotistas recebem, então o dinheiro sai do
// fundo e entra nas contas sem ser criado nem destruído. Se o caixa não cobrir o
// total, o CHECK de saldo não negativo aborta o tick inteiro, sinalizando estado
// corrompido, nunca um pagamento a descoberto.
func debitFundForPayout(ctx context.Context, tx *sql.Tx, p tick.PendingDividendPayment) error {
	var held int64
	for _, r := range p.Recipients {
		held += int64(r.Quantity)
	}
	total := etf.DistributionTotal(p.ValuePerShare, held)
	shares := int(held)
	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    p.FundAccountID,
		AssetID:   &p.AssetID,
		EventType: domain.EventETFDividendPayout,
		Quantity:  &shares,
		UnitValue: &p.ValuePerShare,
	}); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE accounts SET current_balance = current_balance - $1, updated_at = now() WHERE user_id = $2`,
		total, p.FundAccountID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx,
		`UPDATE etf_details SET dividends_payable = GREATEST(dividends_payable - $1, 0) WHERE asset_id = $2`,
		total, p.AssetID,
	)
	return err
}

// saveETFExpenses grava a taxa de administração de um ETF no dia (tarefa R.9): soma a
// taxa do dia ao passivo e, quando o fundo quita a acumulada, grava o evento
// etf_expense_payout ANTES de debitar o caixa (Event Sourcing) e abate o passivo pelo
// mesmo valor. O dinheiro pago sai da economia simulada (é receita do administrador,
// fora do modelo), como qualquer débito de custo do fundo.
func saveETFExpenses(ctx context.Context, tx *sql.Tx, n tick.ETFNAVEntry) error {
	if n.ExpensePaid > 0 {
		var fundAccountID string
		if err := tx.QueryRowContext(ctx, `SELECT fund_account_id FROM etf_details WHERE asset_id = $1`, n.ETFAssetID).Scan(&fundAccountID); err != nil {
			return err
		}
		quantity := 1
		if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
			UserID:    fundAccountID,
			AssetID:   &n.ETFAssetID,
			EventType: domain.EventETFExpensePayout,
			Quantity:  &quantity,
			UnitValue: &n.ExpensePaid,
		}); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE accounts SET current_balance = current_balance - $1, updated_at = now() WHERE user_id = $2`,
			n.ExpensePaid, fundAccountID,
		); err != nil {
			return err
		}
	}
	if n.ExpenseAccrued != 0 || n.ExpensePaid != 0 {
		if _, err := tx.ExecContext(ctx,
			`UPDATE etf_details SET fees_payable = GREATEST(fees_payable + $1 - $2, 0) WHERE asset_id = $3`,
			n.ExpenseAccrued, n.ExpensePaid, n.ETFAssetID,
		); err != nil {
			return err
		}
	}
	return nil
}

// tickAdvisoryLockKey identifica a trava consultiva do Postgres que serializa o
// tick entre processos (tarefa S.3): o job agendado de cada instância e o POST
// /admin/tick disputam a mesma chave.
const tickAdvisoryLockKey int64 = 7_301_001

// TryLockTick tenta pegar a trava consultiva do tick sem bloquear. A trava vive
// numa conexão dedicada até release, porque trava consultiva de sessão pertence
// à conexão que a pegou.
func (r *TickRepository) TryLockTick(ctx context.Context) (func(), bool, error) {
	conn, err := r.db.Conn(ctx)
	if err != nil {
		return nil, false, err
	}
	var locked bool
	if err := conn.QueryRowContext(ctx, `SELECT pg_try_advisory_lock($1)`, tickAdvisoryLockKey).Scan(&locked); err != nil {
		_ = conn.Close()
		return nil, false, err
	}
	if !locked {
		_ = conn.Close()
		return nil, false, nil
	}
	release := func() {
		_, _ = conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock($1)`, tickAdvisoryLockKey)
		_ = conn.Close()
	}
	return release, true, nil
}

// LastTickAt devolve o instante do último SaveTick (market_calendar.updated_at).
func (r *TickRepository) LastTickAt(ctx context.Context) (time.Time, bool, error) {
	var at time.Time
	err := r.db.QueryRowContext(ctx, `SELECT updated_at FROM market_calendar WHERE id = 1`).Scan(&at)
	if err == sql.ErrNoRows {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, err
	}
	return at, true, nil
}

// saveDeclarations grava, atomicamente com o tick, as declarações de dividendo retidas hoje
// (MO.6.11) e marca como liberadas as que viraram provento neste tick, com a data-ex real.
// Idempotente: reter de novo o mesmo ciclo é ignorado e liberar de novo só repete o estado.
func saveDeclarations(ctx context.Context, tx *sql.Tx, result tick.Result) error {
	for _, h := range result.HeldDeclarations {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO governance_pending_declarations (company_id, cycle_index, report_day, held_day, pool_net_income)
			 VALUES ($1, $2, $3, $3, $4) ON CONFLICT (company_id, cycle_index) DO NOTHING`,
			h.CompanyID, h.CycleIndex, h.ReportDay, h.PoolNetIncome); err != nil {
			return err
		}
	}
	for _, rel := range result.ReleasedDeclarations {
		if _, err := tx.ExecContext(ctx,
			`UPDATE governance_pending_declarations
			 SET status = 'released', released_day = $2, release_ex_day = NULLIF($3, 0), release_reason = $4
			 WHERE id = $1 AND status = 'held'`,
			rel.ID, result.State.Day, rel.ExDay, rel.Reason); err != nil {
			return err
		}
	}
	return nil
}
