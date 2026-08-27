package fixedincome

// RegressiveIncomeTaxRate calcula a alíquota de Imposto de Renda regressivo
// sobre o rendimento de renda fixa tributada (Lei 11.033/2004, tarefa
// 6.0.5): quanto mais tempo o título permanece aplicado, menor a alíquota
// sobre o ganho. daysHeld é o prazo em dias corridos entre a aplicação e o
// resgate/vencimento — não dias úteis, diferente das fórmulas de
// precificação deste pacote (PrefixedPrice, EarlyRedemption), que usam DU.
// Ativos com tax_exempt = true (LCI/LCA/CRI/CRA, spec seção 4) nunca chamam
// esta função — o retorno líquido deles é sempre igual ao bruto,
// verificado no ponto de chamada (fixedincomeexecution), não aqui.
func RegressiveIncomeTaxRate(daysHeld int) float64 {
	switch {
	case daysHeld <= 180:
		return 0.225
	case daysHeld <= 360:
		return 0.20
	case daysHeld <= 720:
		return 0.175
	default:
		return 0.15
	}
}
