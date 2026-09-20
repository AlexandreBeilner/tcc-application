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

// IndexType classifica como o rendimento de um produto de renda fixa é
// determinado (TCC cap. 2.2) — consumido pelas tarefas L.1/L.2
// (backlog-motor-mercado-realista) pra decidir a fórmula de precificação
// certa em fixedincomeexecution.Purchase/Redeem, e pela L.3 (restringir
// marcação a mercado a produtos com taxa travada na compra — Prefixado e
// IPCA+, spec 3.2.1 — excluindo os pós-fixados; decisão confirmada com o
// usuário).
type IndexType string

const (
	// IndexPrefixado trava a taxa contratada na compra pro resto da vida
	// do título — deságio nominal sobre o Valor Nominal (PrefixedPrice),
	// sujeito a marcação a mercado se vendido antes do vencimento (TCC cap.
	// 2.2.3). Só Tesouro Prefixado é assim de verdade.
	IndexPrefixado IndexType = "prefixado"
	// IndexPosFixado rende de acordo com um percentual do CDI/Selic
	// simulada, que varia dia a dia (TCC lição 1.2/3.3, ex: "CDB 110% CDI",
	// "LCI 90% CDI") — nunca uma taxa travada na compra, nunca marcado a
	// mercado (não há "taxa de mercado" separada da própria Selic pra um
	// produto que já rende ela mesma). Tesouro Selic, CDB, LCI, LCA, CRI,
	// CRA (L.3, proposta seção 9, item 3, lista os 6 juntos como
	// "isentos de risco de mercado").
	IndexPosFixado IndexType = "pos_fixado"
	// IndexIPCAMais rende IPCA + uma taxa real contratada (VNA), via
	// fixedincome.VNAProjected/IPCAPrice (tarefa L.2 liga as duas fórmulas
	// em fixedincomeexecution.Purchase/Redeem — antes disso, IPCA+
	// reaproveitava o deságio nominal do Prefixado). Só Tesouro IPCA+. A
	// taxa real contratada funciona como uma prefixada sobre o VNA, então
	// segue sujeita a marcação a mercado se vendida antes do vencimento
	// (fixedincome.IPCAEarlyRedemption) — mesmo grupo do IndexPrefixado
	// pra esse efeito, decisão confirmada com o usuário na L.3.
	IndexIPCAMais IndexType = "ipca_mais"
)

// classification fixa emissor, isenção de IR e o índice de rendimento por
// tipo de produto — regra de negócio, não atributo livre (spec seção 4:
// "LCI/LCA/CRI/CRA isentos de IR vs CDB/Tesouro tributados"; CDB/LCI/LCA
// emitidos por bancos, CRI/CRA por securitizadoras, Tesouro pelo governo —
// TCC lições 1.3/1.5/1.9 do currículo).
var classification = map[ProductType]struct {
	Issuer    IssuerType
	TaxExempt bool
	Index     IndexType
}{
	ProductTesouroSelic:     {IssuerTesouro, false, IndexPosFixado},
	ProductTesouroPrefixado: {IssuerTesouro, false, IndexPrefixado},
	ProductTesouroIPCA:      {IssuerTesouro, false, IndexIPCAMais},
	ProductCDB:              {IssuerBanco, false, IndexPosFixado},
	ProductLCI:              {IssuerBanco, true, IndexPosFixado},
	ProductLCA:              {IssuerBanco, true, IndexPosFixado},
	ProductCRI:              {IssuerSecuritizadora, true, IndexPosFixado},
	ProductCRA:              {IssuerSecuritizadora, true, IndexPosFixado},
}

// IndexOf devolve o IndexType de productType, ok = false se o tipo for
// desconhecido (mesmo tratamento de erro "silencioso" de RequiresCreditRiskRating
// — quem chama decide o que fazer com um tipo fora do catálogo).
func IndexOf(productType ProductType) (IndexType, bool) {
	c, ok := classification[productType]
	if !ok {
		return "", false
	}
	return c.Index, true
}

// IsPostFixado indica se productType rende de acordo com um percentual do
// CDI/Selic simulada, que varia dia a dia, em vez de uma taxa travada na
// compra (IndexPrefixado) ou do VNA do IPCA (IndexIPCAMais) — usado por
// fixedincomeexecution.Purchase/Redeem (tarefa L.1) pra escolher entre
// fixedincome.PrefixedPrice e fixedincome.PostFixedValue.
func IsPostFixado(productType ProductType) bool {
	idx, ok := IndexOf(productType)
	return ok && idx == IndexPosFixado
}

// IsIPCAMais indica se productType rende IPCA + uma taxa real contratada,
// via VNA (IndexIPCAMais) — usado por fixedincomeexecution.Purchase/Redeem
// (tarefa L.2) pra escolher fixedincome.VNAProjected/IPCAPrice em vez de
// PrefixedPrice. Só Tesouro IPCA+ hoje.
func IsIPCAMais(productType ProductType) bool {
	idx, ok := IndexOf(productType)
	return ok && idx == IndexIPCAMais
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
