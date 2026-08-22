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
