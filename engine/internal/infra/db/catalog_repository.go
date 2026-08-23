package db

import (
	"context"
	"database/sql"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fixedincome"
)

// listAssetsColumns é reaproveitada por ListAssets/FindAssetByID — mesma
// projeção, muda só o WHERE.
const listAssetsColumns = `id, ticker, name, type, risk_class, is_sandbox`

func scanAssetRecord(scan func(dest ...any) error) (catalog.AssetRecord, error) {
	var rec catalog.AssetRecord
	var assetType string
	if err := scan(&rec.ID, &rec.Ticker, &rec.Name, &assetType, &rec.RiskClass, &rec.IsSandbox); err != nil {
		return catalog.AssetRecord{}, err
	}
	rec.Type = catalog.AssetType(assetType)
	return rec, nil
}

// CatalogRepository persiste o catálogo de mercado (assets/companies e
// suas especializações) contra o banco "market". Diferente de
// AccountRepository, não passa por Event Sourcing — catálogo é dado
// cadastral, não evento financeiro (mesma distinção documentada em
// internal/domain/catalog/asset.go).
type CatalogRepository struct {
	db *sql.DB
}

func NewCatalogRepository(db *sql.DB) *CatalogRepository {
	return &CatalogRepository{db: db}
}

// FindCompanyByCNPJ devolve o id da empresa já cadastrada com este CNPJ,
// se existir — usado pelo seed (tarefa 3.9) pra ser idempotente.
func (r *CatalogRepository) FindCompanyByCNPJ(ctx context.Context, cnpj string) (string, bool, error) {
	var id string
	err := r.db.QueryRowContext(ctx, `SELECT id FROM companies WHERE cnpj = $1`, cnpj).Scan(&id)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (r *CatalogRepository) CreateCompany(ctx context.Context, c catalog.Company) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO companies (name, cnpj, sector, report_frequency_days)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		c.Name, c.CNPJ, string(c.Sector), c.ReportFrequencyDays,
	).Scan(&id)
	return id, err
}

// FindAssetByTicker devolve o id do ativo já cadastrado com este ticker,
// se existir — usado pelo seed pra ser idempotente.
func (r *CatalogRepository) FindAssetByTicker(ctx context.Context, ticker string) (string, bool, error) {
	var id string
	err := r.db.QueryRowContext(ctx, `SELECT id FROM assets WHERE ticker = $1`, ticker).Scan(&id)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (r *CatalogRepository) CreateAsset(ctx context.Context, a catalog.Asset) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO assets (ticker, name, type, risk_class, is_sandbox)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		a.Ticker, a.Name, string(a.Type), a.RiskClass, a.IsSandbox,
	).Scan(&id)
	return id, err
}

func (r *CatalogRepository) CreateVariableIncomeAsset(ctx context.Context, v catalog.VariableIncomeAsset) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares)
		 VALUES ($1, $2, $3, $4)`,
		v.AssetID, v.CompanyID, v.ShareClass, v.OutstandingShares,
	)
	return err
}

// CreateFixedIncomeAsset persiste a especialização de renda fixa de um
// asset_id já existente. interestRate e maturityDate são dados de
// catálogo ilustrativos (não há fórmula de geração ainda — spec não fecha
// esses números, mesmo tratamento dado a outros parâmetros "sujeitos à
// calibração da tarefa 8.1" nas tarefas 3.5/3.6).
func (r *CatalogRepository) CreateFixedIncomeAsset(ctx context.Context, assetID string, product fixedincome.FixedIncomeProduct, interestRate float64, maturityDate time.Time) error {
	var creditRiskRating *string
	if product.CreditRiskRating != "" {
		creditRiskRating = &product.CreditRiskRating
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO fixed_income_assets (asset_id, interest_rate, maturity_date, issuer_type, tax_exempt, credit_risk_rating)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		assetID, interestRate, maturityDate, string(product.IssuerType), product.TaxExempt, creditRiskRating,
	)
	return err
}

// CreateETFDetails persiste etf_details + os etf_holdings associados, na
// mesma transação (a lista de holdings não faz sentido sem o details que
// a referencia via FK).
func (r *CatalogRepository) CreateETFDetails(ctx context.Context, assetID string, details etf.Details) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO etf_details (asset_id, benchmark_index, methodology_summary) VALUES ($1, $2, $3)`,
		assetID, details.BenchmarkIndex, details.MethodologySummary,
	); err != nil {
		return err
	}

	for _, h := range details.Holdings {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO etf_holdings (etf_asset_id, constituent_name, weight_pct) VALUES ($1, $2, $3)`,
			assetID, h.ConstituentName, h.WeightPct,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *CatalogRepository) CreateFIIDetails(ctx context.Context, assetID string, details fii.Details) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO fii_details (asset_id, fii_type, segment, net_worth, vacancy_rate, indexador)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		assetID, string(details.Type), details.Segment, details.NetWorth, details.VacancyRate, details.Indexador,
	)
	return err
}

// ListAssets devolve os ativos do catálogo, opcionalmente filtrados por
// assetType (string vazia = sem filtro) — usado por GET /assets (tarefa
// 3.10). O chamador (httpserver) é responsável por validar assetType contra
// catalog.IsValidAssetType antes de chamar, pra não repassar um valor
// inválido pro enum Postgres asset_type.
func (r *CatalogRepository) ListAssets(ctx context.Context, assetType string) ([]catalog.AssetRecord, error) {
	query := `SELECT ` + listAssetsColumns + ` FROM assets`
	args := []any{}
	if assetType != "" {
		query += ` WHERE type = $1`
		args = append(args, assetType)
	}
	query += ` ORDER BY ticker`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var records []catalog.AssetRecord
	for rows.Next() {
		rec, err := scanAssetRecord(rows.Scan)
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// FindAssetByID devolve o ativo de id id, se existir — usado por GET
// /assets/:id (tarefa 3.10).
func (r *CatalogRepository) FindAssetByID(ctx context.Context, id string) (catalog.AssetRecord, bool, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+listAssetsColumns+` FROM assets WHERE id = $1`, id)
	rec, err := scanAssetRecord(row.Scan)
	if err == sql.ErrNoRows {
		return catalog.AssetRecord{}, false, nil
	}
	if err != nil {
		return catalog.AssetRecord{}, false, err
	}
	return rec, true, nil
}

// FindFixedIncomeSpecialization devolve a especialização de renda fixa de
// assetID, se existir — usado por GET /assets/:id pra ativos de renda fixa
// (tarefa 3.10, RF21).
func (r *CatalogRepository) FindFixedIncomeSpecialization(ctx context.Context, assetID string) (catalog.FixedIncomeSpecialization, bool, error) {
	var spec catalog.FixedIncomeSpecialization
	var issuerType string
	var creditRiskRating sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT interest_rate, maturity_date, issuer_type, tax_exempt, credit_risk_rating
		 FROM fixed_income_assets WHERE asset_id = $1`, assetID,
	).Scan(&spec.InterestRate, &spec.MaturityDate, &issuerType, &spec.TaxExempt, &creditRiskRating)
	if err == sql.ErrNoRows {
		return catalog.FixedIncomeSpecialization{}, false, nil
	}
	if err != nil {
		return catalog.FixedIncomeSpecialization{}, false, err
	}
	spec.IssuerType = fixedincome.IssuerType(issuerType)
	if creditRiskRating.Valid {
		spec.CreditRiskRating = &creditRiskRating.String
	}
	return spec, true, nil
}

// FindEquitySpecialization devolve a especialização de ação de assetID
// (empresa emissora + classe) — usado por GET /assets/:id pra ativos type =
// 'acao' (tarefa 3.10, RF21). Só existe linha em variable_income_assets com
// company_id preenchido pra ações (ETF/FII têm company_id nulo — spec 3.6),
// por isso o INNER JOIN não perde ação nenhuma.
func (r *CatalogRepository) FindEquitySpecialization(ctx context.Context, assetID string) (catalog.EquitySpecialization, bool, error) {
	var spec catalog.EquitySpecialization
	var sector string
	err := r.db.QueryRowContext(ctx,
		`SELECT via.share_class, via.outstanding_shares, c.id, c.name, c.cnpj, c.sector
		 FROM variable_income_assets via
		 JOIN companies c ON c.id = via.company_id
		 WHERE via.asset_id = $1`, assetID,
	).Scan(&spec.ShareClass, &spec.OutstandingShares, &spec.CompanyID, &spec.CompanyName, &spec.CompanyCNPJ, &sector)
	if err == sql.ErrNoRows {
		return catalog.EquitySpecialization{}, false, nil
	}
	if err != nil {
		return catalog.EquitySpecialization{}, false, err
	}
	spec.CompanySector = catalog.Sector(sector)
	return spec, true, nil
}

// FindETFDetails devolve etf_details + etf_holdings de assetID, se existir
// — usado por GET /assets/:id pra ativos type = 'etf' (tarefa 3.10, RF21).
// Reconstrói etf.Details direto do banco sem passar por etf.NewDetails: os
// dados já foram validados na escrita (CreateETFDetails), releitura não
// revalida.
func (r *CatalogRepository) FindETFDetails(ctx context.Context, assetID string) (etf.Details, bool, error) {
	var benchmarkIndex string
	var methodologySummary sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT benchmark_index, methodology_summary FROM etf_details WHERE asset_id = $1`, assetID,
	).Scan(&benchmarkIndex, &methodologySummary)
	if err == sql.ErrNoRows {
		return etf.Details{}, false, nil
	}
	if err != nil {
		return etf.Details{}, false, err
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT constituent_name, weight_pct FROM etf_holdings WHERE etf_asset_id = $1 ORDER BY weight_pct DESC`, assetID,
	)
	if err != nil {
		return etf.Details{}, false, err
	}
	defer func() { _ = rows.Close() }()

	var holdings []etf.Holding
	for rows.Next() {
		var h etf.Holding
		if err := rows.Scan(&h.ConstituentName, &h.WeightPct); err != nil {
			return etf.Details{}, false, err
		}
		holdings = append(holdings, h)
	}
	if err := rows.Err(); err != nil {
		return etf.Details{}, false, err
	}

	return etf.Details{
		BenchmarkIndex:     benchmarkIndex,
		MethodologySummary: methodologySummary.String,
		Holdings:           holdings,
	}, true, nil
}

// FindFIIDetails devolve fii_details de assetID, se existir — usado por GET
// /assets/:id pra ativos type = 'fii' (tarefa 3.10, RF21).
func (r *CatalogRepository) FindFIIDetails(ctx context.Context, assetID string) (fii.Details, bool, error) {
	var d fii.Details
	var fiiType string
	err := r.db.QueryRowContext(ctx,
		`SELECT fii_type, segment, net_worth, vacancy_rate, indexador FROM fii_details WHERE asset_id = $1`, assetID,
	).Scan(&fiiType, &d.Segment, &d.NetWorth, &d.VacancyRate, &d.Indexador)
	if err == sql.ErrNoRows {
		return fii.Details{}, false, nil
	}
	if err != nil {
		return fii.Details{}, false, err
	}
	d.Type = fii.Type(fiiType)
	return d, true, nil
}

// FindCompanyByID devolve a empresa de id id, se existir — usado por GET
// /companies/:id (tarefa 3.10).
func (r *CatalogRepository) FindCompanyByID(ctx context.Context, id string) (catalog.CompanyRecord, bool, error) {
	var rec catalog.CompanyRecord
	var sector string
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, cnpj, sector, report_frequency_days FROM companies WHERE id = $1`, id,
	).Scan(&rec.ID, &rec.Name, &rec.CNPJ, &sector, &rec.ReportFrequencyDays)
	if err == sql.ErrNoRows {
		return catalog.CompanyRecord{}, false, nil
	}
	if err != nil {
		return catalog.CompanyRecord{}, false, err
	}
	rec.Sector = catalog.Sector(sector)
	return rec, true, nil
}

// ListAssetsByCompany devolve os ativos de renda variável emitidos por
// companyID — usado por GET /companies/:id (tarefa 3.10). Só ações têm
// company_id preenchido (ETF/FII não), então essa lista nunca traz ETF/FII.
func (r *CatalogRepository) ListAssetsByCompany(ctx context.Context, companyID string) ([]catalog.IssuedAsset, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.ticker, a.name, via.share_class
		 FROM variable_income_assets via
		 JOIN assets a ON a.id = via.asset_id
		 WHERE via.company_id = $1
		 ORDER BY a.ticker`, companyID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var assets []catalog.IssuedAsset
	for rows.Next() {
		var ia catalog.IssuedAsset
		if err := rows.Scan(&ia.AssetID, &ia.Ticker, &ia.Name, &ia.ShareClass); err != nil {
			return nil, err
		}
		assets = append(assets, ia)
	}
	return assets, rows.Err()
}
