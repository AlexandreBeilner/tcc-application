package fixedincome

import "errors"

// ProductType enumera os tipos de ativo de renda fixa do motor — espelha o
// subconjunto de renda fixa do enum Postgres asset_type (migration
// 000001_init_market_schema).
type ProductType string

const (
	ProductTesouroSelic     ProductType = "tesouro_selic"
	ProductTesouroPrefixado ProductType = "tesouro_prefixado"
	ProductTesouroIPCA      ProductType = "tesouro_ipca"
	ProductCDB              ProductType = "cdb"
	ProductLCI              ProductType = "lci"
	ProductLCA              ProductType = "lca"
	ProductCRI              ProductType = "cri"
	ProductCRA              ProductType = "cra"
)

// IssuerType espelha o enum Postgres issuer_type.
type IssuerType string

const (
	IssuerTesouro        IssuerType = "tesouro"
	IssuerBanco          IssuerType = "banco"
	IssuerSecuritizadora IssuerType = "securitizadora"
)

var (
	ErrUnknownProductType      = errors.New("tipo de produto de renda fixa desconhecido")
	ErrMissingCreditRiskRating = errors.New("classificação de risco de crédito é obrigatória para este produto")
)

// classification fixa emissor e isenção de IR por tipo de produto — regra
// de negócio, não atributo livre (spec seção 4: "LCI/LCA/CRI/CRA isentos
// de IR vs CDB/Tesouro tributados"; CDB/LCI/LCA emitidos por bancos,
// CRI/CRA por securitizadoras, Tesouro pelo governo — TCC lições 1.3/1.5/1.9
// do currículo).
var classification = map[ProductType]struct {
	Issuer    IssuerType
	TaxExempt bool
}{
	ProductTesouroSelic:     {IssuerTesouro, false},
	ProductTesouroPrefixado: {IssuerTesouro, false},
	ProductTesouroIPCA:      {IssuerTesouro, false},
	ProductCDB:              {IssuerBanco, false},
	ProductLCI:              {IssuerBanco, true},
	ProductLCA:              {IssuerBanco, true},
	ProductCRI:              {IssuerSecuritizadora, true},
	ProductCRA:              {IssuerSecuritizadora, true},
}

// RequiresCreditRiskRating indica se o produto precisa de uma
// classificação de risco de crédito do emissor pra ser cadastrado. CRI/CRA
// não contam com a garantia do FGC que protege CDB/LCI/LCA até um limite —
// dependem inteiramente da capacidade de pagamento da securitizadora
// emissora (spec seção 4; TCC currículo, lição 1.9: "CRI e CRA — risco de
// crédito sem FGC"). Tesouro é soberano e CDB/LCI/LCA são cobertos por FGC,
// então não exigem essa classificação aqui.
func RequiresCreditRiskRating(productType ProductType) bool {
	return productType == ProductCRI || productType == ProductCRA
}

// FixedIncomeProduct reúne os três campos de classificação de um ativo de
// renda fixa exigidos pela spec seção 4 (tax_exempt, credit_risk_rating,
// issuer_type — tarefa 2.5).
type FixedIncomeProduct struct {
	Type             ProductType
	IssuerType       IssuerType
	TaxExempt        bool
	CreditRiskRating string
}

// NewFixedIncomeProduct monta a classificação de um ativo de renda fixa a
// partir do tipo de produto. IssuerType e TaxExempt nunca são recebidos
// como parâmetro solto — são sempre derivados aqui a partir do tipo, o que
// garante que um produto não pode nascer com essa classificação incorreta
// (critério de aceite da tarefa 2.5). creditRiskRating é obrigatório
// quando RequiresCreditRiskRating(productType) é verdadeiro.
func NewFixedIncomeProduct(productType ProductType, creditRiskRating string) (FixedIncomeProduct, error) {
	c, ok := classification[productType]
	if !ok {
		return FixedIncomeProduct{}, ErrUnknownProductType
	}
	if RequiresCreditRiskRating(productType) && creditRiskRating == "" {
		return FixedIncomeProduct{}, ErrMissingCreditRiskRating
	}

	return FixedIncomeProduct{
		Type:             productType,
		IssuerType:       c.Issuer,
		TaxExempt:        c.TaxExempt,
		CreditRiskRating: creditRiskRating,
	}, nil
}
