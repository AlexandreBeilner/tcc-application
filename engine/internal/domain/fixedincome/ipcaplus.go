package fixedincome

import (
	"math"
	"time"

	"tcc-investimentos/engine/internal/domain/ipca"
)

// VNAMonthlySeries encadeia leituras sucessivas de IPCA mensal sintético
// (ver package ipca) num VNA (Valor Nominal Atualizado) por mês — o VNA
// conhecido no dia 15 de cada mês, atualizado pelo IPCA daquele mês (TCC
// cap. 2.2.2). vnaInitial é o VNA de partida, no dia 15 do mês anterior ao
// primeiro elemento de monthlyIPCA.
func VNAMonthlySeries(vnaInitial float64, monthlyIPCA []float64) []float64 {
	vnas := make([]float64, len(monthlyIPCA))
	vna := vnaInitial
	for i, ipca := range monthlyIPCA {
		vna *= 1 + ipca
		vnas[i] = vna
	}
	return vnas
}

// day15Window devolve o dia 15 do mês corrente e o dia 15 do mês seguinte
// que envolvem `date` — a "janela de projeção" da eq. 6: se `date` já
// alcançou o dia 15 do mês, a janela é [15 deste mês, 15 do próximo];
// antes disso, é [15 do mês anterior, 15 deste mês]. Comparação por dia
// civil (UTC, hora zerada) — VNA não tem componente intradiário.
func day15Window(date time.Time) (base, next time.Time) {
	day15ThisMonth := time.Date(date.Year(), date.Month(), 15, 0, 0, 0, 0, time.UTC)
	if date.Day() >= 15 {
		base = day15ThisMonth
	} else {
		base = day15ThisMonth.AddDate(0, -1, 0)
	}
	return base, base.AddDate(0, 1, 0)
}

// VNAProjected calcula o Valor Nominal Atualizado projetado do Tesouro
// IPCA+ pra uma data de liquidação qualquer (TCC eq. 6): entre o dia 15 de
// um mês (quando o VNA é conhecido — vnaBase, um elemento de
// VNAMonthlySeries) e o dia 15 do mês seguinte, o VNA é projetado pro rata
// usando o IPCA projetado daquele mês (monthlyIPCA — o IPCA oficial desse
// mês ainda não foi divulgado dentro dessa janela), com o expoente
// proporcional aos dias corridos dentro da janela:
//
//	VNA_proj = VNA_base × (1 + IPCA_projetado)^(dias decorridos / dias da janela)
//
// settlementDate dentro da própria janela de vnaBase (ver day15Window).
func VNAProjected(vnaBase, monthlyIPCA float64, settlementDate time.Time) float64 {
	base, next := day15Window(settlementDate)
	elapsedDays := settlementDate.Sub(base).Hours() / 24
	windowDays := next.Sub(base).Hours() / 24
	return vnaBase * math.Pow(1+monthlyIPCA, elapsedDays/windowDays)
}

// IPCAQuote é a cotação do Tesouro IPCA+ — o fator de deságio do
// componente de juro real contratado na compra (TCC eq. 7), mesma lógica
// de PrefixedPrice (tarefa 2.3), só que como fator adimensional em vez de
// multiplicado pelo Valor Nominal: aqui quem representa a atualização
// monetária é o VNA (VNAProjected); a cotação só precifica o juro real.
// annualRealRate é a taxa real contratada na compra (decimal), travada
// pelo resto da vida da posição — só o VNA muda dia a dia, nunca essa
// taxa (critério de aceite da tarefa 3.4).
func IPCAQuote(annualRealRate float64, businessDaysToMaturity int) float64 {
	exponent := float64(businessDaysToMaturity) / BusinessDaysPerYear
	return 1 / math.Pow(1+annualRealRate, exponent)
}

// IPCAPrice é o preço final de compra do Tesouro IPCA+ (TCC eq. 7): o
// produto do VNA projetado (VNAProjected) pela cotação (IPCAQuote).
func IPCAPrice(vnaProjected, quote float64) float64 {
	return vnaProjected * quote
}

// VNAEpoch é a data-base do VNA sintético do Tesouro IPCA+ — 15/07/2000,
// mesma convenção do Tesouro Nacional real (VNA = R$1.000,00 na data-base,
// FaceValue aqui). Fixa (não amarrada à data de deploy/seed do catálogo) de
// propósito, pra CurrentVNAWindow ficar 100% determinística a partir só de
// `ipca.Config`/`now` (RNF08) — nenhum estado precisa ser persistido nem
// avançado por tick pra essa reprodutibilidade valer (tarefa L.2,
// backlog-motor-mercado-realista; ver nota do pacote fixedincomeexecution).
var VNAEpoch = time.Date(2000, time.July, 15, 0, 0, 0, 0, time.UTC)

// monthsBetween conta quantos meses civis separam duas datas fixadas no
// dia 15 (a e b sempre vêm de VNAEpoch/day15Window, nunca de uma data
// arbitrária) — base pra saber quantos "meses" de ipca.MonthlySeries já se
// passaram desde VNAEpoch até a janela corrente.
func monthsBetween(a, b time.Time) int {
	return (b.Year()-a.Year())*12 + int(b.Month()-a.Month())
}

// CurrentVNAWindow deriva, sem nenhum estado persistido, o par
// (vnaBase, monthlyIPCA) que VNAProjected espera pra `now` — vnaBase é o
// VNA conhecido no dia 15 do mês-base da janela que contém `now`
// (day15Window), monthlyIPCA é o IPCA sintético desse mês. Os dois nascem
// encadeando ipca.MonthlySeries (determinística por cfg/seed, RNF08) desde
// VNAEpoch (vna inicial = FaceValue, mesma convenção real) via
// VNAMonthlySeries — mesma cfg e mesma data sempre devolvem o mesmo par,
// então nenhum consumidor (fixedincomeexecution.Purchase/Redeem) precisa
// de um histórico gravado dia a dia: essa é a tarefa M.1 (independente),
// que serve pra EXIBIR a série ao usuário, não pra calculá-la aqui.
func CurrentVNAWindow(cfg ipca.Config, now time.Time) (vnaBase, monthlyIPCA float64) {
	base, _ := day15Window(now)
	windowIndex := monthsBetween(VNAEpoch, base)

	series := ipca.MonthlySeries(cfg, windowIndex+1)
	monthlyIPCA = series[windowIndex]
	if windowIndex == 0 {
		return FaceValue, monthlyIPCA
	}
	vnas := VNAMonthlySeries(FaceValue, series[:windowIndex])
	return vnas[windowIndex-1], monthlyIPCA
}

// IPCAEarlyRedemption calcula o preço marcado a mercado no resgate
// antecipado de um Tesouro IPCA+ (TCC cap. 2.2.3) — mesma decomposição de
// EarlyRedemption (Prefixado), só que sobre o VNA projetado hoje (vnaNow,
// CurrentVNAWindow + VNAProjected) em vez do Valor Nominal fixo: o preço de
// mercado é o produto do VNA pela cotação de juro real vigente (IPCAQuote
// com a taxa de mercado corrente); o que o título valeria hoje se a taxa
// real contratada não tivesse mudado usa o mesmo VNA (a atualização
// monetária não depende da taxa contratada, só o componente de juro real
// muda). currentMarketRealRate já vem convertido pelo chamador
// (fixedincomeexecution.Redeem) via FisherRealRate — a correção de Fisher
// nominal/real foi resolvida pela tarefa L.4, esta função em si continua
// agnóstica de onde a taxa real veio (recebe o número já pronto).
func IPCAEarlyRedemption(purchasePrice, purchaseRealRate, currentMarketRealRate, vnaNow float64, remainingBusinessDays int) EarlyRedemptionResult {
	markPrice := IPCAPrice(vnaNow, IPCAQuote(currentMarketRealRate, remainingBusinessDays))
	accruedAtContractedRate := IPCAPrice(vnaNow, IPCAQuote(purchaseRealRate, remainingBusinessDays))

	return EarlyRedemptionResult{
		MarkToMarketPrice: markPrice,
		RealizedReturnPct: (markPrice/purchasePrice - 1) * 100,
		VsContractedRate:  markPrice - accruedAtContractedRate,
	}
}
