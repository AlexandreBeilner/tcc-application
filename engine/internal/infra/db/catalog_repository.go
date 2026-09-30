package db

import (
	"context"
	"database/sql"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/simcalendar"
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
	db    *sql.DB
	cache quoteCache
}

// NewCatalogRepository recebe cache já resolvido pelo chamador (main.go) —
// infra/cache.RedisQuoteCache quando REDIS_URL está configurada,
// infra/cache.NoopQuoteCache caso contrário (tarefa 5.7). Nunca nil: um
// *RedisQuoteCache nil embrulhado na interface quoteCache cairia na
// armadilha de "typed nil" (chamar Get/Set nele entraria no método com
// receiver nil e estouraria em c.client) — por isso a ausência de cache é
// sempre um valor concreto (NoopQuoteCache{}), nunca um ponteiro nil.
func NewCatalogRepository(db *sql.DB, cache quoteCache) *CatalogRepository {
	return &CatalogRepository{db: db, cache: cache}
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
		`INSERT INTO companies (name, cnpj, sector, report_frequency_days, base_growth_pct)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		c.Name, c.CNPJ, string(c.Sector), c.ReportFrequencyDays, c.BaseGrowthPct,
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
// asset_id já existente. interestRate, maturityDate e minimumInvestment
// são dados de catálogo ilustrativos (não há fórmula de geração ainda —
// spec não fecha esses números, mesmo tratamento dado a outros parâmetros
// "sujeitos à calibração da tarefa 8.1" nas tarefas 3.5/3.6/3.13).
func (r *CatalogRepository) CreateFixedIncomeAsset(ctx context.Context, assetID string, product fixedincome.FixedIncomeProduct, interestRate float64, maturityDate time.Time, minimumInvestment float64) error {
	var creditRiskRating *string
	if product.CreditRiskRating != "" {
		creditRiskRating = &product.CreditRiskRating
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO fixed_income_assets (asset_id, interest_rate, maturity_date, issuer_type, tax_exempt, credit_risk_rating, minimum_investment)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		assetID, interestRate, maturityDate, string(product.IssuerType), product.TaxExempt, creditRiskRating, minimumInvestment,
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
			`INSERT INTO etf_holdings (etf_asset_id, constituent_name, asset_id, weight_pct) VALUES ($1, $2, $3, $4)`,
			assetID, h.ConstituentName, h.AssetID, h.WeightPct,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ReplaceETFHoldings troca a composição de um ETF já existente pela de
// details, na mesma transação — usado pelo seed (tarefa R.1) pra migrar a
// cesta antiga do SINT11, que tinha renda fixa, para uma cesta só de Ação e
// FII num banco que já rodava antes da Fase R. Quem chama já validou details
// por etf.NewDetails.
func (r *CatalogRepository) ReplaceETFHoldings(ctx context.Context, assetID string, details etf.Details) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM etf_holdings WHERE etf_asset_id = $1`, assetID); err != nil {
		return err
	}
	for _, h := range details.Holdings {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO etf_holdings (etf_asset_id, constituent_name, asset_id, weight_pct) VALUES ($1, $2, $3, $4)`,
			assetID, h.ConstituentName, h.AssetID, h.WeightPct,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// FindETFFundAccountID devolve a conta de fundo do ETF (etf_details.
// fund_account_id, tarefa R.1). found = false quando o ETF não existe ou ainda
// não tem fundo ligado (banco anterior à migration 000026, antes do seed).
func (r *CatalogRepository) FindETFFundAccountID(ctx context.Context, assetID string) (string, bool, error) {
	var fundAccountID sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT fund_account_id FROM etf_details WHERE asset_id = $1`, assetID,
	).Scan(&fundAccountID)
	if err == sql.ErrNoRows || (err == nil && !fundAccountID.Valid) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return fundAccountID.String, true, nil
}

// AttachETFFundAccount liga a conta de fundo (já criada em accounts) ao ETF e,
// se outstanding_shares ainda é NULL, fixa o número de cotas na soma das
// posições existentes (zero num ETF sem ninguém posicionado) — o total de cotas
// em posições passa a ser sempre igual a outstanding_shares (R.2). Idempotente:
// não mexe em cotas já definidas.
func (r *CatalogRepository) AttachETFFundAccount(ctx context.Context, assetID, fundAccountID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`UPDATE etf_details SET fund_account_id = $2 WHERE asset_id = $1`, assetID, fundAccountID,
	); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE variable_income_assets
		 SET outstanding_shares = (SELECT COALESCE(SUM(quantity), 0) FROM positions WHERE asset_id = $1)
		 WHERE asset_id = $1 AND outstanding_shares IS NULL`, assetID,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *CatalogRepository) CreateFIIDetails(ctx context.Context, assetID string, details fii.Details) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO fii_details (asset_id, fii_type, segment, net_worth, vacancy_rate, indexador, portfolio_value)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		assetID, string(details.Type), details.Segment, details.NetWorth, details.VacancyRate, details.Indexador, details.PortfolioValue,
	)
	return err
}

// RecalibrateFIIBaseValueIfNeverQuoted (tarefa U.5) grava o valor-base inicial
// do FII (net_worth no tijolo, portfolio_value no papel) só se o ativo ainda
// não tem nenhuma cotação (asset_quotes): um volume que já rodou ticks teve o
// valor-base evoluído pelo motor (Selic, ruído), e sobrescrevê-lo apagaria
// histórico de fundamento. Devolve se alterou. É dado de fundamento, não move
// saldo nem posição, então não passa por market_events.
func (r *CatalogRepository) RecalibrateFIIBaseValueIfNeverQuoted(ctx context.Context, assetID string, baseValue float64) (bool, error) {
	// $2 é arredondado a 2 casas (escala das colunas numeric): sem isso a
	// comparação com o valor já gravado nunca bate e a chamada nunca é idempotente.
	res, err := r.db.ExecContext(ctx,
		`UPDATE fii_details
		    SET net_worth = CASE WHEN fii_type = 'tijolo' THEN ROUND($2::numeric, 2) ELSE net_worth END,
		        portfolio_value = CASE WHEN fii_type = 'papel' THEN ROUND($2::numeric, 2) ELSE portfolio_value END
		  WHERE asset_id = $1
		    AND NOT EXISTS (SELECT 1 FROM asset_quotes WHERE asset_id = $1)
		    AND ((fii_type = 'tijolo' AND net_worth IS DISTINCT FROM ROUND($2::numeric, 2))
		      OR (fii_type = 'papel' AND portfolio_value IS DISTINCT FROM ROUND($2::numeric, 2)))`,
		assetID, baseValue)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
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
// assetID, se existir — usado por GET /assets/:id (tela 3.10, RF21) e por
// GET /fixed-income/simulate (handleFixedIncomeSimulate), os dois únicos
// consumidores de InterestRate fora da compra/resgate real. InterestRate
// (tarefa L.4) deixa de ser sempre o dado cru do catálogo pra Prefixado/
// IPCA+: reprecificaOfertaParaExibicao (abaixo) devolve a mesma taxa
// ofertada hoje que fixedincomeexecution.Purchase travaria numa compra
// nova (fixedincome.OfferedRate/FisherRealRate — mesmas fórmulas, mesma
// fonte de Selic/IPCA), garantindo que listagem/simulador nunca mostrem um
// número diferente do que a compra de verdade cobraria. Pós-fixado e
// sandbox não passam por essa reprecificação (nota do doc de
// reprecificarOfertaParaExibicao).
func (r *CatalogRepository) FindFixedIncomeSpecialization(ctx context.Context, assetID string) (catalog.FixedIncomeSpecialization, bool, error) {
	var spec catalog.FixedIncomeSpecialization
	var issuerType string
	var creditRiskRating sql.NullString
	var productType string
	var isSandbox bool
	err := r.db.QueryRowContext(ctx,
		`SELECT fia.interest_rate, fia.maturity_date, fia.issuer_type, fia.tax_exempt, fia.credit_risk_rating, fia.minimum_investment, a.type, a.is_sandbox
		 FROM fixed_income_assets fia JOIN assets a ON a.id = fia.asset_id
		 WHERE fia.asset_id = $1`, assetID,
	).Scan(&spec.InterestRate, &spec.MaturityDate, &issuerType, &spec.TaxExempt, &creditRiskRating, &spec.MinimumInvestment, &productType, &isSandbox)
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
	if !isSandbox && spec.InterestRate != nil {
		if offered, ok, err := r.reprecificarOfertaParaExibicao(ctx, fixedincome.ProductType(productType), *spec.InterestRate); err != nil {
			return catalog.FixedIncomeSpecialization{}, false, err
		} else if ok {
			spec.InterestRate = &offered
		}
	}
	return spec, true, nil
}

// CurrentSelicRatePct devolve a Selic simulada corrente (%), lida de
// market_calendar — exposta como método público (em vez de só o helper
// pacote-privado currentSelicRatePct) pra handleFixedIncomeSimulate
// (achado do teste de ponta a ponta da Fase L, httpserver/fixedincome.go)
// poder projetar produto pós-fixado sem duplicar a query. ok = false (sem
// erro) antes do primeiro tick do Temporizador — mesmo contrato de
// currentSelicRatePct.
func (r *CatalogRepository) CurrentSelicRatePct(ctx context.Context) (float64, bool, error) {
	return currentSelicRatePct(ctx, r.db)
}

// CurrentSimulatedDay devolve market_calendar.current_day (0 antes do primeiro
// tick) — o "agora" das leituras de catálogo que dependem de tempo (ex:
// Dividend Yield dos últimos 12 meses simulados, tarefa S.1).
func (r *CatalogRepository) CurrentSimulatedDay(ctx context.Context) (int, error) {
	return loadSimulatedDay(ctx, r.db)
}

// reprecificarOfertaParaExibicao aplica fixedincome.OfferedRate/
// FisherRealRate (tarefa L.4) sobre o spread do catálogo (spreadPct),
// mesma fórmula que fixedincomeexecution.Purchase usa pra travar a taxa
// contratada de uma compra nova — só pra Prefixado (benchmark = Selic
// nominal corrente) e IPCA+ (benchmark = taxa real via Fisher, Selic
// nominal + IPCA acumulado em 12 meses, M.1). Pós-fixado (spread já é "%
// do CDI", L.1 — sem benchmark a somar) devolve ok=false, sem reprecificar
// — spec.InterestRate fica com o valor cru do catálogo. ok=false também
// quando o Temporizador ainda não rodou nenhum tick (currentSelicRatePct/
// currentIPCAAccumulated12m sem linha) — diferente de Purchase/Redeem
// (que tratam essa falta de precondição como erro via
// ErrMarketCalendarNotInitialized), aqui é só exibição: melhor mostrar o
// spread cru do que devolver 500 numa tela de listagem antes do primeiro
// tick.
func (r *CatalogRepository) reprecificarOfertaParaExibicao(ctx context.Context, productType fixedincome.ProductType, spreadPct float64) (float64, bool, error) {
	switch {
	case fixedincome.IsPrefixado(productType):
		selic, ok, err := currentSelicRatePct(ctx, r.db)
		if err != nil || !ok {
			return 0, false, err
		}
		return fixedincome.OfferedRate(spreadPct/100, selic/100) * 100, true, nil
	case fixedincome.IsIPCAMais(productType):
		selic, ok, err := currentSelicRatePct(ctx, r.db)
		if err != nil || !ok {
			return 0, false, err
		}
		accumulated, ok, err := currentIPCAAccumulated12m(ctx, r.db)
		if err != nil || !ok {
			return 0, false, err
		}
		realBenchmark := fixedincome.FisherRealRate(selic/100, accumulated)
		return fixedincome.OfferedRate(spreadPct/100, realBenchmark) * 100, true, nil
	default:
		return 0, false, nil
	}
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
		`SELECT constituent_name, asset_id, weight_pct FROM etf_holdings WHERE etf_asset_id = $1 ORDER BY weight_pct DESC`, assetID,
	)
	if err != nil {
		return etf.Details{}, false, err
	}
	defer func() { _ = rows.Close() }()

	var holdings []etf.Holding
	for rows.Next() {
		var h etf.Holding
		var holdingAssetID sql.NullString
		if err := rows.Scan(&h.ConstituentName, &holdingAssetID, &h.WeightPct); err != nil {
			return etf.Details{}, false, err
		}
		if holdingAssetID.Valid {
			h.AssetID = &holdingAssetID.String
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

// FindLatestETFNAV devolve o NAV mais recente do ETF e as cotas emitidas
// (tarefa R.3). found = false enquanto o ETF não tem NAV (sem emissão ou antes
// do primeiro tick depois dela).
func (r *CatalogRepository) FindLatestETFNAV(ctx context.Context, assetID string) (catalog.ETFNAV, bool, error) {
	var n catalog.ETFNAV
	err := r.db.QueryRowContext(ctx,
		`SELECT h.simulated_day, h.nav, h.premium_pct, h.tracking_error_pct, via.outstanding_shares
		 FROM etf_nav_history h JOIN variable_income_assets via ON via.asset_id = h.etf_asset_id
		 WHERE h.etf_asset_id = $1 ORDER BY h.simulated_day DESC LIMIT 1`, assetID,
	).Scan(&n.SimulatedDay, &n.NAV, &n.PremiumPct, &n.TrackingErrorPct, &n.OutstandingShares)
	if err == sql.ErrNoRows {
		return catalog.ETFNAV{}, false, nil
	}
	if err != nil {
		return catalog.ETFNAV{}, false, err
	}
	return n, true, nil
}

// FindFIIDetails devolve fii_details de assetID, se existir — usado por GET
// /assets/:id pra ativos type = 'fii' (tarefa 3.10, RF21).
func (r *CatalogRepository) FindFIIDetails(ctx context.Context, assetID string) (fii.Details, bool, error) {
	var d fii.Details
	var fiiType string
	err := r.db.QueryRowContext(ctx,
		`SELECT fii_type, segment, net_worth, vacancy_rate, indexador, portfolio_value FROM fii_details WHERE asset_id = $1`, assetID,
	).Scan(&fiiType, &d.Segment, &d.NetWorth, &d.VacancyRate, &d.Indexador, &d.PortfolioValue)
	if err == sql.ErrNoRows {
		return fii.Details{}, false, nil
	}
	if err != nil {
		return fii.Details{}, false, err
	}
	d.Type = fii.Type(fiiType)
	return d, true, nil
}

// dailyChangePct calcula a variação percentual entre o preço corrente e o
// anterior — nil se não houver dia anterior pra comparar (ativo com uma só
// cotação, ainda). Reaproveitada por FindCurrentQuote/ListCurrentQuotes.
func dailyChangePct(current float64, previous *float64) *float64 {
	if previous == nil || *previous == 0 {
		return nil
	}
	pct := (current - *previous) / *previous * 100
	return &pct
}

// FindCurrentQuote devolve a cotação mais recente de assetID (asset_quotes,
// tarefa 3.11) e sua variação percentual contra o dia simulado anterior —
// usado por GET /assets/:id (tarefa 4.6). found = false se o ativo nunca
// teve cotação gerada (Temporizador nunca rodou pra ele, ou é renda fixa,
// que não tem cotação de mercado nesse sentido). Cache de leitura (tarefa
// 5.7): checa quoteCache primeiro — TickRepository.SaveTick já mantém essa
// entrada quente via write-through a cada tick, então a leitura de mais
// alta frequência do sistema (RF04, cutoff "agora" do net worth via
// GET /assets do backend) normalmente nem chega no Postgres.
func (r *CatalogRepository) FindCurrentQuote(ctx context.Context, assetID string) (catalog.Quote, bool, error) {
	return cachedQuote(ctx, r.cache, assetID, r.loadCurrentQuoteFromPostgres)
}

// loadCurrentQuoteFromPostgres é o load original de FindCurrentQuote, antes
// da tarefa 5.7 — extraído pra ficar reaproveitável como o parâmetro func
// de cachedQuote, sem duplicar a query de 2 linhas.
func (r *CatalogRepository) loadCurrentQuoteFromPostgres(ctx context.Context, assetID string) (catalog.Quote, bool, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT price FROM asset_quotes WHERE asset_id = $1 ORDER BY simulated_day DESC LIMIT 2`, assetID,
	)
	if err != nil {
		return catalog.Quote{}, false, err
	}
	defer func() { _ = rows.Close() }()

	var prices []float64
	for rows.Next() {
		var price float64
		if err := rows.Scan(&price); err != nil {
			return catalog.Quote{}, false, err
		}
		prices = append(prices, price)
	}
	if err := rows.Err(); err != nil {
		return catalog.Quote{}, false, err
	}
	if len(prices) == 0 {
		return catalog.Quote{}, false, nil
	}

	quote := catalog.Quote{Price: prices[0]}
	if len(prices) == 2 {
		quote.DailyChangePct = dailyChangePct(prices[0], &prices[1])
	}
	return quote, true, nil
}

// ListCurrentQuotes devolve a cotação corrente de todo ativo com pelo menos
// uma linha em asset_quotes, indexada por asset_id — usado por GET /assets
// (tarefa 4.6) pra não fazer uma consulta por ativo (N+1). Ativo sem
// cotação nenhuma (renda fixa, ou renda variável que o Temporizador ainda
// não precificou) simplesmente não aparece no mapa.
func (r *CatalogRepository) ListCurrentQuotes(ctx context.Context) (map[string]catalog.Quote, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT asset_id, price, previous_price FROM (
		   SELECT asset_id, price,
		          LAG(price) OVER (PARTITION BY asset_id ORDER BY simulated_day) AS previous_price,
		          ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY simulated_day DESC) AS rn
		   FROM asset_quotes
		 ) ranked WHERE rn = 1`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	quotes := make(map[string]catalog.Quote)
	for rows.Next() {
		var assetID string
		var price float64
		var previousPrice *float64
		if err := rows.Scan(&assetID, &price, &previousPrice); err != nil {
			return nil, err
		}
		quotes[assetID] = catalog.Quote{Price: price, DailyChangePct: dailyChangePct(price, previousPrice)}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return quotes, nil
}

// ListQuoteHistory devolve a série histórica de asset_quotes de assetID,
// ordenada cronologicamente e limitada aos days dias mais recentes — usada
// por GET /assets/:id/quotes (tarefa 4.6, base do gráfico de preço, RF04).
// Lista vazia (não erro) se o ativo nunca teve cotação gerada.
func (r *CatalogRepository) ListQuoteHistory(ctx context.Context, assetID string, days int) ([]catalog.QuoteHistoryEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT simulated_day, price FROM (
		   SELECT simulated_day, price FROM asset_quotes
		   WHERE asset_id = $1
		   ORDER BY simulated_day DESC
		   LIMIT $2
		 ) recent ORDER BY simulated_day ASC`,
		assetID, days,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	entries := make([]catalog.QuoteHistoryEntry, 0)
	for rows.Next() {
		var e catalog.QuoteHistoryEntry
		if err := rows.Scan(&e.SimulatedDay, &e.Price); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
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

// ListFundamentalsByCompany devolve o histórico de company_fundamentals de
// companyID, mais recente primeiro — usado por GET /companies/:id (tarefa
// 3.14) pra expor as linhas geradas pelo ciclo de relatórios conectado ao
// Temporizador.
func (r *CatalogRepository) ListFundamentalsByCompany(ctx context.Context, companyID string) ([]catalog.FundamentalsEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT period_date, net_revenue FROM company_fundamentals
		 WHERE company_id = $1
		 ORDER BY period_date DESC, created_at DESC`, companyID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var entries []catalog.FundamentalsEntry
	for rows.Next() {
		var e catalog.FundamentalsEntry
		if err := rows.Scan(&e.PeriodDate, &e.NetRevenue); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// FindLatestFundamentals devolve o ciclo de relatório mais recente
// (company_fundamentals) de companyID — found = false se a empresa nunca
// teve nenhum ciclo de relatório rodado ainda (Temporizador nunca chegou
// no dia de relatório dela). Usado por GET /assets/:id (tarefa 4.8) pra
// calcular os indicadores de ação — mesma ordenação de
// ListFundamentalsByCompany, só a primeira linha.
func (r *CatalogRepository) FindLatestFundamentals(ctx context.Context, companyID string) (catalog.FundamentalsSnapshot, bool, error) {
	var f catalog.FundamentalsSnapshot
	err := r.db.QueryRowContext(ctx,
		`SELECT net_revenue, net_income, ebit, net_equity, gross_debt, cash_equivalents
		 FROM company_fundamentals
		 WHERE company_id = $1
		 ORDER BY period_date DESC, created_at DESC
		 LIMIT 1`, companyID,
	).Scan(&f.NetRevenue, &f.NetIncome, &f.EBIT, &f.NetEquity, &f.GrossDebt, &f.CashEquivalents)
	if err == sql.ErrNoRows {
		return catalog.FundamentalsSnapshot{}, false, nil
	}
	if err != nil {
		return catalog.FundamentalsSnapshot{}, false, err
	}
	return f, true, nil
}

// sqlExecer é o subconjunto de *sql.DB/*sql.Tx que insertCompanyFundamentals
// precisa — deixa a mesma query reaproveitável fora (CreateInitialFundamentals,
// sem transação) e dentro (TickRepository.SaveTick, tick_repository.go,
// dentro da transação do tick) de uma transação, sem duplicar o SQL.
type sqlExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// insertCompanyFundamentals grava uma linha nova de company_fundamentals —
// única fonte do INSERT (mesmas 8 colunas, mesma ordem) usada tanto por
// CreateInitialFundamentals (achado de review: estava duplicado à mão aqui e
// em TickRepository.SaveTick, tick_repository.go) quanto pelo ciclo diário
// de relatório do Temporizador.
func insertCompanyFundamentals(ctx context.Context, exec sqlExecer, companyID string, periodDate time.Time, f fundamentals.Financials) error {
	_, err := exec.ExecContext(ctx,
		`INSERT INTO company_fundamentals (company_id, period_date, net_revenue, net_income, ebit, net_equity, gross_debt, cash_equivalents)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		companyID, periodDate, f.NetRevenue, f.NetIncome, f.EBIT, f.NetEquity, f.GrossDebt, f.CashEquivalents,
	)
	return err
}

// CreateInitialFundamentals grava a primeira linha de company_fundamentals
// de uma empresa fora do ciclo do Temporizador (achado da sessão D.2, seed)
// — sem isso, uma empresa recém-cadastrada cai no fallback genérico
// fundamentals.DefaultBaseRevenue (calibrado pra uma empresa pequena
// qualquer, nunca contra o outstanding_shares real de um ativo específico
// do catálogo) até o primeiro dia de relatório dela, produzindo um preço
// justo (bot.FundamentalistFairPrice, Fase D.2) sem nenhuma relação com o
// preço de mercado seedado. period_date é a data do dia simulado
// corrente (mesma convenção de SaveTick/company_fundamentals). Não passa por Event
// Sourcing (mesmo raciocínio de dado cadastral já documentado no resto
// deste arquivo). Chame só depois de confirmar via FindLatestFundamentals
// que a empresa ainda não tem nenhum ciclo — não é idempotente sozinha.
func (r *CatalogRepository) CreateInitialFundamentals(ctx context.Context, companyID string, f fundamentals.Financials) error {
	today, err := loadSimulatedDay(ctx, r.db)
	if err != nil {
		return err
	}
	return insertCompanyFundamentals(ctx, r.db, companyID, simcalendar.DateOf(today), f)
}

// ListDividendHistory devolve o histórico de dividend_events de assetID,
// mais recente primeiro — usado por GET /assets/:id (tarefa 4.9) pra
// ação/FII, tanto pra exibir a lista quanto pra somar os últimos 12 meses
// e calcular o Dividend Yield (RF21). Não filtra por paid: a spec quer o
// histórico de proventos gerados, não só os já efetivamente pagos. Lista
// vazia (não erro) se o ativo nunca gerou provento nenhum.
func (r *CatalogRepository) ListDividendHistory(ctx context.Context, assetID string) ([]catalog.DividendHistoryEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT value_per_share, ex_date, payment_date FROM dividend_events WHERE asset_id = $1 ORDER BY payment_date DESC`, assetID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	entries := make([]catalog.DividendHistoryEntry, 0)
	for rows.Next() {
		var e catalog.DividendHistoryEntry
		if err := rows.Scan(&e.ValuePerShare, &e.ExDate, &e.PaymentDate); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
