package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/catalogadmin"
)

// CatalogAdminRepository lê e altera o catálogo pelo painel (tarefa N.12). É dado
// cadastral (não Event Sourcing): a edição é um UPDATE direto, limitado aos campos que
// catalogadmin.Patch deixa passar.
type CatalogAdminRepository struct {
	db *sql.DB
}

func NewCatalogAdminRepository(db *sql.DB) *CatalogAdminRepository {
	return &CatalogAdminRepository{db: db}
}

// catalogQuery traz uma linha por ativo (inclusive sandbox, marcado) com os blocos de cada
// classe, numa consulta só: a cesta do ETF vem agregada em JSON pra não custar uma ida por ETF.
const catalogQuery = `
SELECT a.id, a.ticker, a.name, a.type::text, a.risk_class, a.is_sandbox,
       via.share_class, via.outstanding_shares,
       co.id, co.name, co.sector::text, co.report_frequency_days, co.base_growth_pct, co.quality_multiplier,
       ed.asset_id IS NOT NULL, ed.benchmark_index, ed.methodology_summary, ed.expense_ratio_pct, ed.rebalance_frequency_days,
       COALESCE((SELECT json_agg(json_build_object('name', h.constituent_name, 'weight', h.weight_pct) ORDER BY h.weight_pct DESC, h.constituent_name)
                 FROM etf_holdings h WHERE h.etf_asset_id = a.id), '[]'::json),
       fd.asset_id IS NOT NULL, fd.fii_type::text, fd.segment, fd.vacancy_rate, fd.indexador,
       fi.asset_id IS NOT NULL, fi.interest_rate, to_char(fi.maturity_date, 'YYYY-MM-DD'), fi.issuer_type::text,
       fi.tax_exempt, fi.credit_risk_rating, fi.minimum_investment
FROM assets a
LEFT JOIN variable_income_assets via ON via.asset_id = a.id
LEFT JOIN companies co ON co.id = via.company_id
LEFT JOIN etf_details ed ON ed.asset_id = a.id
LEFT JOIN fii_details fd ON fd.asset_id = a.id
LEFT JOIN fixed_income_assets fi ON fi.asset_id = a.id`

func scanCatalogEntry(scan func(dest ...any) error) (catalogadmin.Entry, error) {
	var (
		e                              catalogadmin.Entry
		assetType                      string
		risk, shareClass               sql.NullString
		shares                         sql.NullInt64
		companyID, companyName, sector sql.NullString
		reportDays                     sql.NullInt64
		baseGrowth, quality            sql.NullFloat64
		isETF                          bool
		benchmark, methodology         sql.NullString
		expense                        sql.NullFloat64
		rebalance                      sql.NullInt64
		holdingsJSON                   []byte
		isFII                          bool
		fiiType, segment, indexador    sql.NullString
		vacancy                        sql.NullFloat64
		isFixed                        bool
		rate                           sql.NullFloat64
		maturity, issuer, rating       sql.NullString
		taxExempt                      sql.NullBool
		minimum                        sql.NullFloat64
	)
	if err := scan(&e.AssetID, &e.Ticker, &e.Name, &assetType, &risk, &e.IsSandbox,
		&shareClass, &shares,
		&companyID, &companyName, &sector, &reportDays, &baseGrowth, &quality,
		&isETF, &benchmark, &methodology, &expense, &rebalance, &holdingsJSON,
		&isFII, &fiiType, &segment, &vacancy, &indexador,
		&isFixed, &rate, &maturity, &issuer, &taxExempt, &rating, &minimum); err != nil {
		return e, err
	}
	e.Type = catalog.AssetType(assetType)
	e.RiskClass = nullString(risk)
	e.ShareClass = nullString(shareClass)
	if shares.Valid {
		e.OutstandingShares = &shares.Int64
	}
	if companyID.Valid {
		e.Company = &catalogadmin.CompanyParams{
			CompanyID: companyID.String, Name: companyName.String, Sector: sector.String,
			ReportFrequencyDays: int(reportDays.Int64), BaseGrowthPct: baseGrowth.Float64, QualityMultiplier: quality.Float64,
		}
	}
	if isETF {
		var raw []struct {
			Name   string  `json:"name"`
			Weight float64 `json:"weight"`
		}
		if err := json.Unmarshal(holdingsJSON, &raw); err != nil {
			return e, fmt.Errorf("cesta do ETF %s: %w", e.Ticker, err)
		}
		etf := &catalogadmin.ETFParams{
			BenchmarkIndex: benchmark.String, MethodologySummary: nullString(methodology),
			ExpenseRatioPct: expense.Float64, RebalanceFrequencyDays: int(rebalance.Int64),
			Holdings: make([]catalogadmin.Holding, 0, len(raw)),
		}
		for _, h := range raw {
			etf.Holdings = append(etf.Holdings, catalogadmin.Holding{Name: h.Name, WeightPct: h.Weight})
			etf.HoldingsTotalWeightPct += h.Weight
		}
		e.ETF = etf
	}
	if isFII {
		e.FII = &catalogadmin.FIIParams{FIIType: fiiType.String, Segment: nullString(segment), Indexador: nullString(indexador)}
		if vacancy.Valid {
			e.FII.VacancyRate = &vacancy.Float64
		}
	}
	if isFixed {
		fi := &catalogadmin.FixedIncomeParams{
			MaturityDate: nullString(maturity), IssuerType: issuer.String, TaxExempt: taxExempt.Bool,
			CreditRiskRating: nullString(rating), MinimumInvestment: minimum.Float64,
		}
		if rate.Valid {
			fi.InterestRate = &rate.Float64
		}
		e.FixedIncome = fi
	}
	return e, nil
}

func nullString(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}

// List devolve o catálogo inteiro ordenado por classe e ticker.
func (r *CatalogAdminRepository) List(ctx context.Context) ([]catalogadmin.Entry, error) {
	return r.list(ctx, r.db)
}

type catalogQuerier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (r *CatalogAdminRepository) list(ctx context.Context, q catalogQuerier) ([]catalogadmin.Entry, error) {
	rows, err := q.QueryContext(ctx, catalogQuery+` ORDER BY a.type, a.ticker`)
	if err != nil {
		return nil, fmt.Errorf("listar catálogo: %w", err)
	}
	defer func() { _ = rows.Close() }()
	entries := []catalogadmin.Entry{}
	for rows.Next() {
		e, err := scanCatalogEntry(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("ler linha do catálogo: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (r *CatalogAdminRepository) get(ctx context.Context, q catalogQuerier, assetID string) (catalogadmin.Entry, error) {
	e, err := scanCatalogEntry(q.QueryRowContext(ctx, catalogQuery+` WHERE a.id = $1`, assetID).Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return e, catalogadmin.ErrNotFound
	}
	if err != nil {
		return e, fmt.Errorf("ler ativo do catálogo: %w", err)
	}
	return e, nil
}

// Get devolve um ativo ou catalogadmin.ErrNotFound.
func (r *CatalogAdminRepository) Get(ctx context.Context, assetID string) (catalogadmin.Entry, error) {
	return r.get(ctx, r.db, assetID)
}

// Update aplica o patch numa transação, travando a linha do ativo pra a validação de
// classe e sandbox feita pelo serviço não ficar velha, e devolve o ativo já alterado. Os
// campos de empresa valem pra empresa emissora (ON e PN do mesmo emissor).
func (r *CatalogAdminRepository) Update(ctx context.Context, assetID string, patch catalogadmin.Patch) (catalogadmin.Entry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return catalogadmin.Entry{}, fmt.Errorf("abrir transação: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var assetType string
	var sandbox bool
	err = tx.QueryRowContext(ctx, `SELECT type::text, is_sandbox FROM assets WHERE id = $1 FOR UPDATE`, assetID).Scan(&assetType, &sandbox)
	if errors.Is(err, sql.ErrNoRows) {
		return catalogadmin.Entry{}, catalogadmin.ErrNotFound
	}
	if err != nil {
		return catalogadmin.Entry{}, fmt.Errorf("travar ativo: %w", err)
	}
	if err := patch.Validate(catalog.AssetType(assetType), sandbox); err != nil {
		return catalogadmin.Entry{}, err
	}

	if patch.Name != nil {
		if _, err := tx.ExecContext(ctx, `UPDATE assets SET name = $2 WHERE id = $1`, assetID, *patch.Name); err != nil {
			return catalogadmin.Entry{}, fmt.Errorf("gravar nome: %w", err)
		}
	}
	if patch.BaseGrowthPct != nil || patch.QualityMultiplier != nil {
		if _, err := tx.ExecContext(ctx, `
			UPDATE companies SET
			  base_growth_pct = COALESCE($2, base_growth_pct),
			  quality_multiplier = COALESCE($3, quality_multiplier)
			WHERE id = (SELECT company_id FROM variable_income_assets WHERE asset_id = $1)`,
			assetID, patch.BaseGrowthPct, patch.QualityMultiplier); err != nil {
			return catalogadmin.Entry{}, fmt.Errorf("gravar parâmetros da empresa: %w", err)
		}
	}
	if patch.Methodology != nil {
		var value any
		if *patch.Methodology != "" {
			value = *patch.Methodology
		}
		if _, err := tx.ExecContext(ctx, `UPDATE etf_details SET methodology_summary = $2 WHERE asset_id = $1`, assetID, value); err != nil {
			return catalogadmin.Entry{}, fmt.Errorf("gravar metodologia: %w", err)
		}
	}

	entry, err := r.get(ctx, tx, assetID)
	if err != nil {
		return entry, err
	}
	if err := tx.Commit(); err != nil {
		return catalogadmin.Entry{}, fmt.Errorf("confirmar transação: %w", err)
	}
	return entry, nil
}
