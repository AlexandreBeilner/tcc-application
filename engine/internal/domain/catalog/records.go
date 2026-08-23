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
// negócio modelada em fixedincome.
type FixedIncomeSpecialization struct {
	InterestRate     *float64
	MaturityDate     *time.Time
	IssuerType       fixedincome.IssuerType
	TaxExempt        bool
	CreditRiskRating *string
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
