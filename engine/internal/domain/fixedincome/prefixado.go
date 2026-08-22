// Package fixedincome contém as fórmulas de precificação de renda fixa do
// motor de simulação (Tesouro Prefixado, IPCA+, CDB/LCA/LCI/CRI/CRA,
// marcação a mercado — TCC cap. 2.2) como funções puras, testáveis sem
// infraestrutura.
package fixedincome

import "math"

// FaceValue é o Valor Nominal do Tesouro Prefixado no vencimento — sempre
// R$1.000,00 por definição do próprio título (TCC cap. 2.2.1), não um
// parâmetro configurável.
const FaceValue = 1000.00

// BusinessDaysPerYear é a base de dias úteis usada nas fórmulas de renda
// fixa do TCC (cap. 2.2.1) — mesma convenção citada na spec 3.2 para a
// conversão de volatilidade do GBM (semana 3).
const BusinessDaysPerYear = 252

// PrefixedPrice calcula o preço de compra de um Tesouro Prefixado pela
// lógica de deságio (TCC eq. 5, cap. 2.2.1):
//
//	Preço = VN / (1 + Taxa)^(DU/252)
//
// annualRate é a taxa contratada na compra, em decimal (ex: 0.10 para 10%
// a.a.). businessDaysToMaturity é o DU entre a data de liquidação e o
// vencimento. O investidor paga menos que o Valor Nominal e recebe R$1.000
// no vencimento — a diferença é o deságio, a fonte da rentabilidade.
func PrefixedPrice(annualRate float64, businessDaysToMaturity int) float64 {
	exponent := float64(businessDaysToMaturity) / BusinessDaysPerYear
	return FaceValue / math.Pow(1+annualRate, exponent)
}
