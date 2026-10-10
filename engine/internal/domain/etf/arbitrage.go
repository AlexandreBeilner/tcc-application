package etf

import "math"

// Parâmetros da arbitragem do Participante Autorizado ligada ao tick (tarefa
// R.6): valores ilustrativos, mesma calibração fina da tarefa 8.1.
//
// ArbitrageActionBandPct é a faixa morta em que o participante não age: só
// arbitra quando o preço de mercado se afasta do iNAV além dela. É mais larga
// que ArbitrageMispricingThresholdPct (0,5%, faixa da função pura H.3) de
// propósito: o Market Maker cota o ETF em torno do iNAV com spread de 2% (±1%),
// então um último preço no bid ou no ask do formador é ruído de spread, não
// ágio. Um participante real só age quando o desvio cobre spread e custo de
// execução da cesta; 1,5% deixa margem sobre o 1% do formador.
//
// ArbitrageDailyCapPct é o teto de cotas criadas ou resgatadas por dia (fração
// das cotas em circulação): mantém o custo e o impacto de preço proporcionais ao
// tamanho do fundo, não ao do catálogo. ArbitrageRampPct é o quanto além da
// faixa o desvio precisa ir para o lote chegar ao teto (abaixo disso o lote é
// proporcional). ArbitrageCashMargin é a folga de caixa sobre o custo estimado
// da perna comprada, pra cobrir o deslize de preço ao varrer o book.
const (
	ArbitrageActionBandPct = 0.015
	ArbitrageDailyCapPct   = 0.02
	ArbitrageRampPct       = 0.02
	ArbitrageCashMargin    = 1.3
)

// ArbitrageDirection é o que o participante faz com um ETF num dia.
type ArbitrageDirection int

const (
	// ArbitrageNone: preço dentro da faixa, nada a fazer (e nenhum comando extra).
	ArbitrageNone ArbitrageDirection = iota
	// ArbitrageCreate: ágio, então compra a cesta, cria cotas e as vende.
	ArbitrageCreate
	// ArbitrageRedeem: deságio, então compra cotas, resgata e vende a cesta.
	ArbitrageRedeem
)

// ArbitrageSignal compara o preço de mercado com o iNAV e devolve a direção da
// arbitragem e o desvio absoluto (fração do NAV). Preço ou NAV não positivos
// devolvem ArbitrageNone.
func ArbitrageSignal(price, nav float64) (ArbitrageDirection, float64) {
	if price <= 0 || nav <= 0 {
		return ArbitrageNone, 0
	}
	deviation := (price - nav) / nav
	switch {
	case deviation > ArbitrageActionBandPct:
		return ArbitrageCreate, deviation
	case deviation < -ArbitrageActionBandPct:
		return ArbitrageRedeem, -deviation
	default:
		return ArbitrageNone, math.Abs(deviation)
	}
}

// ArbitrageShares dimensiona o lote do dia: proporcional ao quanto o desvio
// passa da faixa (cheio a partir de ArbitrageRampPct além dela), limitado a
// ArbitrageDailyCapPct das cotas em circulação, e no mínimo 1 cota quando há
// desvio além da faixa. Sem cotas em circulação ou sem desvio, 0.
func ArbitrageShares(outstanding int64, deviation float64) int64 {
	excess := deviation - ArbitrageActionBandPct
	if outstanding <= 0 || excess <= 0 {
		return 0
	}
	fraction := math.Min(1, excess/ArbitrageRampPct)
	shares := int64(math.Ceil(float64(outstanding) * ArbitrageDailyCapPct * fraction))
	if shares < 1 {
		shares = 1
	}
	return shares
}

// SupportedShares devolve o maior número de cotas, até wanted, que a cesta
// pro-rata de criação (arredondada pra cima, ProRataBasket) consegue cobrir com o
// que o participante detém (held): fill parcial reduz o lote, nunca deixa uma
// criação pela metade. fundHoldings é o que o fundo detém de cada constituinte.
func SupportedShares(fundHoldings []BasketLeg, outstanding, wanted int64, held map[string]int64) int64 {
	if outstanding <= 0 || wanted <= 0 {
		return 0
	}
	shares := wanted
	for _, h := range fundHoldings {
		if h.Quantity <= 0 {
			continue
		}
		// ceil(h.Quantity*s/outstanding) <= held  <=>  h.Quantity*s <= held*outstanding
		if fit := held[h.AssetID] * outstanding / h.Quantity; fit < shares {
			shares = fit
		}
	}
	return shares
}
