package fixedincome

// EarlyRedemptionResult descreve o resultado de um resgate antecipado de
// um Tesouro Prefixado — antes do vencimento, o título é vendido pelo
// preço marcado a mercado do dia, não pelo Valor Nominal (TCC cap. 2.2.3).
type EarlyRedemptionResult struct {
	// MarkToMarketPrice é o preço do título hoje, reprecificado pela
	// mesma fórmula de deságio (eq. 5, tarefa 2.3), só que com a taxa de
	// mercado vigente em vez da taxa contratada na compra.
	MarkToMarketPrice float64
	// RealizedReturnPct é o retorno total obtido desde a compra até hoje,
	// em %, comparando o preço de mercado hoje com o preço pago na compra.
	RealizedReturnPct float64
	// VsContractedRate é a diferença entre o preço de mercado hoje e o
	// preço que o título teria hoje se a taxa de mercado não tivesse
	// saído da taxa contratada na compra. Positivo é ganho extraordinário
	// (juros de mercado caíram desde a compra); negativo é rentabilidade
	// inferior à contratada (juros de mercado subiram) — os dois cenários
	// descritos no TCC cap. 2.2.3.
	VsContractedRate float64
}

// EarlyRedemption calcula o preço marcado a mercado no dia do resgate
// antecipado de um Tesouro Prefixado e o ganho/perda resultante (TCC cap.
// 2.2.3). purchasePrice e purchaseRate vêm da compra original (eq. 5,
// tarefa 2.3); currentMarketRate é a taxa de mercado vigente no dia do
// resgate; remainingBusinessDays é o DU restante até o vencimento nesse
// dia (mesmo prazo usado tanto pra marcar a mercado quanto pra calcular o
// que o título renderia se a taxa contratada não tivesse mudado).
//
// A reprecificação diária do título — a cada dia útil, o preço muda
// porque o DU restante encolhe e a taxa de mercado pode ter se movido — é
// exatamente essa mesma fórmula reaplicada a cada dia; EarlyRedemption é
// só o ponto em que essa reprecificação vira uma decisão de venda.
func EarlyRedemption(purchasePrice, purchaseRate, currentMarketRate float64, remainingBusinessDays int) EarlyRedemptionResult {
	markPrice := PrefixedPrice(currentMarketRate, remainingBusinessDays)
	accruedAtContractedRate := PrefixedPrice(purchaseRate, remainingBusinessDays)

	return EarlyRedemptionResult{
		MarkToMarketPrice: markPrice,
		RealizedReturnPct: (markPrice/purchasePrice - 1) * 100,
		VsContractedRate:  markPrice - accruedAtContractedRate,
	}
}
