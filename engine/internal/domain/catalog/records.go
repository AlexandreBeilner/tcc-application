package catalog

import (
	"time"

	"tcc-investimentos/engine/internal/domain/fixedincome"
)

// AssetRecord é um Asset já persistido no catálogo — Asset mais o id
// gerado pelo banco na inserção (não faz parte do construtor porque só
// existe depois de passar por CatalogRepository.CreateAsset). Usado pelas
// leituras da tarefa 3.10 (GET /assets, GET /assets/:id).
type AssetRecord struct {
	ID string
	Asset
}

// CompanyRecord é uma Company já persistida — mesmo raciocínio de
// AssetRecord, usado por GET /companies/:id (tarefa 3.10).
type CompanyRecord struct {
	ID string
	Company
}

// IssuedAsset é um ativo de renda variável emitido por uma empresa, como
// listado em GET /companies/:id (tarefa 3.10) — só os campos relevantes
// pra essa listagem, não o Asset completo.
type IssuedAsset struct {
	AssetID    string
	Ticker     string
	Name       string
	ShareClass *string
}

// FixedIncomeSpecialization é a especialização de renda fixa lida do
// catálogo (fixed_income_assets, tarefa 3.10) — reaproveita
// fixedincome.IssuerType pra classificação e acrescenta
// interest_rate/maturity_date, dado ilustrativo de catálogo sem fórmula de
// geração ainda (mesma nota da tarefa 3.9), que não faz parte da regra de
// negócio modelada em fixedincome. MinimumInvestment (tarefa 3.13) não é
// ponteiro — a coluna é NOT NULL desde a migration 000006, todo produto
// tem uma aplicação mínima.
type FixedIncomeSpecialization struct {
	InterestRate      *float64
	MaturityDate      *time.Time
	IssuerType        fixedincome.IssuerType
	TaxExempt         bool
	CreditRiskRating  *string
	MinimumInvestment float64
}

// EquitySpecialization é a especialização de ação lida do catálogo
// (variable_income_assets + companies, tarefa 3.10) — a empresa emissora e
// a classe de ação exibidas na tela de detalhe de ativo pra essa classe
// (RF21). Campos da empresa vêm soltos, não como CompanyRecord, porque só
// os quatro usados na resposta importam aqui (ReportFrequencyDays não faz
// sentido nessa tela).
type EquitySpecialization struct {
	CompanyID         string
	CompanyName       string
	CompanyCNPJ       string
	CompanySector     Sector
	ShareClass        *string
	OutstandingShares *int64
}

// Quote é a cotação corrente de um ativo de renda variável (acao/etf/fii),
// lida de asset_quotes (tarefa 3.11) — usada por GET /assets e GET
// /assets/:id (tarefa 4.6). DailyChangePct fica nil quando só existe uma
// cotação (sem dia anterior pra comparar), não quando ela é zero.
type Quote struct {
	Price          float64
	DailyChangePct *float64
}

// QuoteHistoryEntry é uma linha da série histórica de asset_quotes de um
// ativo, ordenada cronologicamente — usada por GET /assets/:id/quotes
// (tarefa 4.6, base do gráfico de preço da tela 4.5, RF04).
type QuoteHistoryEntry struct {
	SimulatedDay int
	Price        float64
}

// FundamentalsEntry é uma linha já persistida de company_fundamentals,
// gerada pelo ciclo de relatórios trimestrais conectado ao Temporizador
// (tarefa 3.14) — usada por GET /companies/:id (tarefa 3.10) pra expor o
// histórico de fundamentos. Só NetRevenue vem preenchido hoje (mesma nota
// de escopo de tick.FundamentalsRecord: net_income/ebit/net_equity/
// gross_debt/cash_equivalents ainda não têm fórmula de geração), por isso é
// ponteiro — nullable tanto no schema quanto na prática.
type FundamentalsEntry struct {
	PeriodDate time.Time
	NetRevenue *float64
}

// FundamentalsSnapshot é o ciclo de relatório mais recente de uma empresa
// (company_fundamentals) — usado por GET /assets/:id (tarefa 4.8) pra
// calcular os indicadores de ação (RF21). Cada campo continua ponteiro
// porque uma linha gravada antes da tarefa 4.8 só tem NetRevenue
// preenchido (os outros cinco ficaram NULL) — nesse caso os indicadores
// que dependem deles ficam omitidos, não 0 (mesmo critério de aceite de
// "empresa sem ciclo de relatório ainda").
type FundamentalsSnapshot struct {
	NetRevenue      *float64
	NetIncome       *float64
	EBIT            *float64
	NetEquity       *float64
	GrossDebt       *float64
	CashEquivalents *float64
}
