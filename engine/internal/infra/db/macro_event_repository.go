package db

import (
	"context"
	"database/sql"
	"strconv"
	"strings"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/macroeventadmin"
	"tcc-investimentos/engine/internal/domain/tick"
)

// MacroEventRepository implementa macroeventtrigger.Repository contra o
// banco "market" — macro_events/macro_event_targets (schema ajustado pela
// tarefa 4.1) e a leitura do dia simulado corrente em market_calendar
// (tarefa 3.11).
type MacroEventRepository struct {
	db *sql.DB
}

func NewMacroEventRepository(db *sql.DB) *MacroEventRepository {
	return &MacroEventRepository{db: db}
}

// LoadCurrentDay lê market_calendar.current_day — ErrMarketCalendarNotInitialized
// (mesmo erro sentinela de fixed_income_execution_repository.go, mesma
// condição: o Temporizador nunca rodou) se a tabela ainda está vazia.
func (r *MacroEventRepository) LoadCurrentDay(ctx context.Context) (int, error) {
	var day int
	err := r.db.QueryRowContext(ctx, `SELECT current_day FROM market_calendar WHERE id = 1`).Scan(&day)
	if err == sql.ErrNoRows {
		return 0, ErrMarketCalendarNotInitialized
	}
	if err != nil {
		return 0, err
	}
	return day, nil
}

// AssetsWithCompany devolve, para cada id existente em assets, se o ativo
// tem empresa emissora (variable_income_assets.company_id) — só ação tem.
// Compara como texto pra que um id malformado seja "inexistente" em vez de
// erro de sintaxe de uuid.
func (r *MacroEventRepository) AssetsWithCompany(ctx context.Context, assetIDs []string) (map[string]bool, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id::text, v.company_id IS NOT NULL
		 FROM assets a
		 LEFT JOIN variable_income_assets v ON v.asset_id = a.id
		 WHERE a.id::text = ANY($1)`,
		pq.Array(assetIDs),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	result := make(map[string]bool, len(assetIDs))
	for rows.Next() {
		var id string
		var hasCompany bool
		if err := rows.Scan(&id, &hasCompany); err != nil {
			return nil, err
		}
		result[id] = hasCompany
	}
	return result, rows.Err()
}

// Persist grava o evento e seus alvos numa única transação: macro_events
// primeiro (RETURNING id), depois um INSERT por Target em
// macro_event_targets — status inicial sempre 'pendente' (macroevent.
// NewEvent já garante isso em memória).
func (r *MacroEventRepository) Persist(ctx context.Context, event macroevent.Event) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	var id string
	err = tx.QueryRowContext(ctx,
		`INSERT INTO macro_events (
			template_key, title, narrative, direction, magnitude_band,
			affects_price, affects_fundamentals, status, created_by,
			triggered_on_day, duration_days, price_effect_pct,
			fundamentals_effect_pct, fundamentals_report_day, reveal_lead_days
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id`,
		event.TemplateKey, event.Title, event.Narrative, string(event.Direction), string(event.MagnitudeBand),
		event.AffectsPrice, event.AffectsFundamentals, string(event.Status), event.CreatedBy,
		event.TriggeredOnDay, event.DurationDays, event.PriceEffectPct,
		event.FundamentalsEffectPct, event.FundamentalsReportDay, event.RevealLeadDays,
	).Scan(&id)
	if err != nil {
		return "", err
	}

	for _, target := range event.Targets {
		var sector *string
		if target.Sector != nil {
			s := string(*target.Sector)
			sector = &s
		}
		var direction *string
		if target.Direction != nil {
			d := string(*target.Direction)
			direction = &d
		}

		if _, err := tx.ExecContext(ctx,
			`INSERT INTO macro_event_targets (
				macro_event_id, sector, risk_class, asset_id, affected_metric,
				direction, price_effect_pct, fundamentals_effect_pct
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			id, sector, target.RiskClass, target.AssetID, string(target.AffectedMetric),
			direction, target.PriceEffectPct, target.FundamentalsEffectPct,
		); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return id, nil
}

// macroEventColumns é a lista de colunas lida por List e Find (a ordem é a do Scan).
const macroEventColumns = `e.id, e.template_key, e.title, e.narrative, e.direction, e.magnitude_band,
		        e.affects_price, e.affects_fundamentals, e.status, e.created_by,
		        e.triggered_on_day, e.duration_days, e.price_effect_pct,
		        e.fundamentals_effect_pct, e.fundamentals_report_day, e.created_at, e.reveal_lead_days`

// scanMacroEvent lê uma linha de macroEventColumns.
func scanMacroEvent(scan func(dest ...any) error) (macroevent.Record, error) {
	var rec macroevent.Record
	var direction, band, status string
	if err := scan(
		&rec.ID, &rec.TemplateKey, &rec.Title, &rec.Narrative, &direction, &band,
		&rec.AffectsPrice, &rec.AffectsFundamentals, &status, &rec.CreatedBy,
		&rec.TriggeredOnDay, &rec.DurationDays, &rec.PriceEffectPct,
		&rec.FundamentalsEffectPct, &rec.FundamentalsReportDay, &rec.CreatedAt, &rec.RevealLeadDays,
	); err != nil {
		return macroevent.Record{}, err
	}
	rec.Direction = macroevent.Direction(direction)
	rec.MagnitudeBand = macroevent.Band(band)
	rec.Status = macroevent.Status(status)
	return rec, nil
}

// listWhere monta o WHERE do histórico a partir do filtro (tarefa N.11). A visão
// pública (feed e calendário do usuário) esconde o cancelado e o agendado antes da
// antecedência de aparição do próprio evento (macroevent.IsPubliclyVisible, N.25); a do
// painel enxerga tudo. Os valores vão
// sempre como parâmetro; um id malformado vira "nenhum evento" em vez de erro de uuid
// porque a comparação é feita como texto.
func listWhere(f macroevent.ListFilter) (string, []any) {
	var conds []string
	var args []any
	add := func(cond string, arg any) {
		args = append(args, arg)
		conds = append(conds, strings.ReplaceAll(cond, "?", "$"+strconv.Itoa(len(args))))
	}
	if f.View == macroevent.ViewPublic {
		conds = append(conds, `e.status <> 'cancelado'`,
			`e.triggered_on_day <= (SELECT current_day FROM market_calendar WHERE id = 1) + e.reveal_lead_days`)
	}
	if f.Status != nil {
		add(`e.status::text = ?`, string(*f.Status))
	}
	if f.FromDay != nil {
		add(`e.triggered_on_day >= ?`, *f.FromDay)
	}
	if f.ToDay != nil {
		add(`e.triggered_on_day <= ?`, *f.ToDay)
	}
	targetCond := func(column string, value *string) {
		if value != nil {
			add(`EXISTS (SELECT 1 FROM macro_event_targets t WHERE t.macro_event_id = e.id AND t.`+column+`::text = ?)`, *value)
		}
	}
	targetCond("sector", f.Sector)
	targetCond("risk_class", f.RiskClass)
	targetCond("asset_id", f.AssetID)
	if len(conds) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

// List devolve o histórico de eventos macro (mais recentes primeiro, por
// created_at), paginado e filtrado — usado por GET /macro-events (tarefa 4.5,
// consumido por GET /admin/macro-events e GET /news no backend). status já
// reflete a aplicação contínua do efeito (tick.Service.Run/SaveTick
// atualizam a coluna a cada tick), não um valor congelado da criação — não
// é preciso recalcular nada aqui, só ler a linha.
func (r *MacroEventRepository) List(ctx context.Context, filter macroevent.ListFilter) ([]macroevent.Record, error) {
	where, args := listWhere(filter)
	args = append(args, filter.Limit, filter.Offset)
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+macroEventColumns+`
		 FROM macro_events e`+where+`
		 ORDER BY e.created_at DESC, e.id
		 LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args)),
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var records []macroevent.Record
	for rows.Next() {
		rec, err := scanMacroEvent(rows.Scan)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := r.attachTargets(ctx, records); err != nil {
		return nil, err
	}
	return records, nil
}

// Count devolve o total de eventos macro que o filtro alcança, sem paginação —
// usado por GET /macro-events (tarefa 6.9.9) pra sustentar "Página X de Y"
// no feed/painel admin, com o mesmo WHERE de List.
func (r *MacroEventRepository) Count(ctx context.Context, filter macroevent.ListFilter) (int, error) {
	where, args := listWhere(filter)
	var count int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM macro_events e`+where, args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

// Find lê um evento com os alvos (macroeventadmin.ErrNotFound se o id não existe;
// um id malformado também é "não existe").
func (r *MacroEventRepository) Find(ctx context.Context, id string) (macroevent.Record, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+macroEventColumns+` FROM macro_events e WHERE e.id::text = $1`, id)
	rec, err := scanMacroEvent(row.Scan)
	if err == sql.ErrNoRows {
		return macroevent.Record{}, macroeventadmin.ErrNotFound
	}
	if err != nil {
		return macroevent.Record{}, err
	}
	records := []macroevent.Record{rec}
	if err := r.attachTargets(ctx, records); err != nil {
		return macroevent.Record{}, err
	}
	return records[0], nil
}

// CancelPending cancela um evento pendente sob a trava do tick (tarefa N.11): a trava
// de transação usa a mesma chave da consultiva do tick, então um tick em andamento
// recusa o cancelamento (tick.ErrTickInProgress) em vez de aplicar o efeito de um
// evento que o admin acabou de cancelar. A linha é lida com FOR UPDATE e decide julga
// o estado visto aqui, na mesma transação do UPDATE.
func (r *MacroEventRepository) CancelPending(ctx context.Context, id string, decide func(status macroevent.Status, triggeredOnDay, currentDay int) error) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var locked bool
	if err := tx.QueryRowContext(ctx, `SELECT pg_try_advisory_xact_lock($1)`, tickAdvisoryLockKey).Scan(&locked); err != nil {
		return err
	}
	if !locked {
		return tick.ErrTickInProgress
	}

	var status string
	var triggeredOnDay int
	err = tx.QueryRowContext(ctx,
		`SELECT status::text, triggered_on_day FROM macro_events WHERE id::text = $1 FOR UPDATE`, id,
	).Scan(&status, &triggeredOnDay)
	if err == sql.ErrNoRows {
		return macroeventadmin.ErrNotFound
	}
	if err != nil {
		return err
	}
	currentDay, err := loadSimulatedDay(ctx, tx)
	if err != nil {
		return err
	}
	if err := decide(macroevent.Status(status), triggeredOnDay, currentDay); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE macro_events SET status = 'cancelado' WHERE id::text = $1`, id); err != nil {
		return err
	}
	return tx.Commit()
}

// StockPrices devolve as ações alcançadas por algum dos alvos (ativo, classe de risco
// ou setor, o mesmo critério do tick) com o preço em baseDay e em endDay. Uma consulta
// só, restrita às ações que algum alvo cobre.
func (r *MacroEventRepository) StockPrices(ctx context.Context, targets []macroevent.Target, baseDay, endDay int) ([]macroeventadmin.AssetPrice, error) {
	var assetIDs, riskClasses, sectors []string
	for _, t := range targets {
		switch {
		case t.AssetID != nil:
			assetIDs = append(assetIDs, *t.AssetID)
		case t.RiskClass != nil:
			riskClasses = append(riskClasses, *t.RiskClass)
		case t.Sector != nil:
			sectors = append(sectors, string(*t.Sector))
		}
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id::text, a.ticker, c.sector::text, COALESCE(a.risk_class, ''), q0.price::float8, q1.price::float8
		 FROM assets a
		 JOIN variable_income_assets v ON v.asset_id = a.id
		 JOIN companies c ON c.id = v.company_id
		 LEFT JOIN asset_quotes q0 ON q0.asset_id = a.id AND q0.simulated_day = $4
		 LEFT JOIN asset_quotes q1 ON q1.asset_id = a.id AND q1.simulated_day = $5
		 WHERE NOT a.is_sandbox AND (a.id::text = ANY($1) OR a.risk_class = ANY($2) OR c.sector::text = ANY($3))
		 ORDER BY a.ticker`,
		pq.Array(assetIDs), pq.Array(riskClasses), pq.Array(sectors), baseDay, endDay,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var prices []macroeventadmin.AssetPrice
	for rows.Next() {
		var p macroeventadmin.AssetPrice
		var before, after sql.NullFloat64
		if err := rows.Scan(&p.AssetID, &p.Ticker, &p.Sector, &p.RiskClass, &before, &after); err != nil {
			return nil, err
		}
		if before.Valid {
			p.PriceBefore = &before.Float64
		}
		if after.Valid {
			p.PriceAfter = &after.Float64
		}
		prices = append(prices, p)
	}
	return prices, rows.Err()
}

// attachTargets busca macro_event_targets pra todo Record de records numa
// segunda query (não dá pra fazer JOIN antes do LIMIT/OFFSET de List sem
// paginar por linha de target em vez de por evento — um evento com N
// targets contaria N vezes) e preenche Record.Targets em memória, mesmo
// padrão de agrupamento já usado por TickRepository.ListPendingMacroEvents
// pro fluxo de aplicação de efeito.
func (r *MacroEventRepository) attachTargets(ctx context.Context, records []macroevent.Record) error {
	if len(records) == 0 {
		return nil
	}

	ids := make([]string, len(records))
	indexByID := make(map[string]int, len(records))
	for i, rec := range records {
		ids[i] = rec.ID
		indexByID[rec.ID] = i
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT macro_event_id, sector, risk_class, asset_id, affected_metric,
		        direction, price_effect_pct, fundamentals_effect_pct
		 FROM macro_event_targets
		 WHERE macro_event_id = ANY($1)`,
		pq.Array(ids),
	)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var eventID string
		var sector, riskClass, assetID, direction sql.NullString
		var affectedMetric string
		var priceEffectPct, fundamentalsEffectPct sql.NullFloat64
		if err := rows.Scan(
			&eventID, &sector, &riskClass, &assetID, &affectedMetric,
			&direction, &priceEffectPct, &fundamentalsEffectPct,
		); err != nil {
			return err
		}

		target := macroevent.Target{AffectedMetric: macroevent.Metric(affectedMetric)}
		if sector.Valid {
			s := catalog.Sector(sector.String)
			target.Sector = &s
		}
		if riskClass.Valid {
			target.RiskClass = &riskClass.String
		}
		if assetID.Valid {
			target.AssetID = &assetID.String
		}
		if direction.Valid {
			d := macroevent.Direction(direction.String)
			target.Direction = &d
		}
		if priceEffectPct.Valid {
			target.PriceEffectPct = &priceEffectPct.Float64
		}
		if fundamentalsEffectPct.Valid {
			target.FundamentalsEffectPct = &fundamentalsEffectPct.Float64
		}

		i := indexByID[eventID]
		records[i].Targets = append(records[i].Targets, target)
	}
	return rows.Err()
}
