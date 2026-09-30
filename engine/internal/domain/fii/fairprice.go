// Package fii — preço justo de cota de FII (tarefa U.1, backlog-motor-mercado-
// realista, achado 024 de pontos-em-aberto-decisao-produto.md). Até aqui nenhum
// bot tinha noção de valor de FII (bot.FundamentalistFairPrice é só de ação), e
// o preço derivava sem âncora (-49% em 200 dias simulados com o patrimônio por
// cota estável). Modelo adotado (decisão do autor, 2026-09-29, opção A), a
// partir de como o mercado real avalia FII, com duas lentes usadas juntas:
//
//  1. P/VP: preço sobre valor patrimonial por cota. Desconto persistente é
//     normal e varia por segmento (lajes corporativas ~0,66x, shoppings
//     ~0,86x, logística com ~18% de desconto médio em reportagens e relatórios
//     de gestoras de 2024-2026).
//  2. Renda contra o juro livre de risco: o spread entre o Dividend Yield do
//     tijolo e a NTN-B ficou em média ~2,9% a 3,0% desde 2016. Juro mais alto
//     exige yield maior e empurra o P/VP pra baixo.
//
// Função pura, sem estado persistido: o preço justo é recalculado a cada rodada
// a partir do patrimônio/carteira por cota (fii_details.net_worth ou
// portfolio_value), da Selic do dia e do segmento. A Selic vale 0-100 (10.0 =
// 10%), mesma escala de selic.Config/NetWorthVariation; efeitos de preço valem
// em % (mesma convenção de macroevent.EffectRange e dividend.EquityPriceEffectPct).
package fii

import "errors"

// Segmentos de FII tijolo com P/VP-base próprio. fii_details.segment é texto
// livre no Postgres (nullable, sem CHECK), então qualquer outro valor cai em
// DefaultTijoloPriceToBook em vez de virar erro (mesmo tratamento de dado de
// catálogo desconhecido que ErrUnknownIndexador pede de quem chama).
const (
	SegmentLajesCorporativas = "Lajes Corporativas"
	SegmentShoppingCenters   = "Shopping Centers"
	SegmentGalpoesLogisticos = "Galpões Logísticos"
)

// P/VP-base por segmento e tipo (valor a que o preço tende com a Selic na
// neutra). Ilustrativos, calibrados só por ordem de grandeza das fontes
// acima, sujeitos à calibração fina da tarefa 8.1 (mesmo tratamento de
// SensitivityByRiskClass e DefaultNetWorthSelicSensitivity). Ficam um pouco
// menos severos que o desconto de mercado de 2024-2026, que reflete um
// momento de juro alto, não um valor estrutural. O papel não tem P/VP-base
// próprio confiável na pesquisa (carteira de recebíveis marcada perto do
// valor de face): 1,00 é declaradamente ilustrativo.
const (
	LajesCorporativasPriceToBook = 0.75
	ShoppingCentersPriceToBook   = 0.88
	GalpoesLogisticosPriceToBook = 0.85
	DefaultTijoloPriceToBook     = 0.85
	PapelPriceToBook             = 1.00
)

// Spread exigido sobre a Selic (pontos percentuais, escala 0-100) e
// sensibilidade (β) do P/VP-alvo ao desvio do yield exigido, por tipo. O
// spread do tijolo vem da média histórica de ~3% sobre a NTN-B; usamos a
// Selic como juro livre de risco porque o motor não tem curva NTN-B. O papel
// é indexado (CDI/IPCA+), então o valor da carteira já acompanha o juro e o
// preço reage menos: β menor, spread menor. Ilustrativos, sujeitos à 8.1.
const (
	TijoloRequiredYieldSpread = 3.0
	PapelRequiredYieldSpread  = 2.0
	TijoloPriceToBookBeta     = 0.5
	PapelPriceToBookBeta      = 0.2
)

// Faixa do P/VP-alvo depois do ajuste pela Selic: nunca menos da metade nem
// mais de uma vez e meia o patrimônio, pra um choque de Selic não produzir um
// preço justo absurdo.
const (
	MinTargetPriceToBook = 0.5
	MaxTargetPriceToBook = 1.5
)

// MinPriceEffectPct é o piso de qualquer efeito de preço percentual aplicado
// ao preço justo: -100% zera o valor, nunca o deixa negativo. O piso de preço
// absoluto (bot.FundamentalistMinFairPrice) fica com quem chama, porque o
// pacote bot já importa domínios vizinhos e não o contrário.
const MinPriceEffectPct = -100.0

var (
	// ErrUnknownFairPriceType é devolvido por TargetPriceToBook pra um tipo
	// de FII que não é tijolo nem papel.
	ErrUnknownFairPriceType = errors.New("tipo de FII sem parâmetros de preço justo")
)

// basePriceToBook devolve o P/VP-base do segmento (tijolo) ou do papel.
func basePriceToBook(fiiType Type, segment string) (float64, error) {
	switch fiiType {
	case TypePapel:
		return PapelPriceToBook, nil
	case TypeTijolo:
		switch segment {
		case SegmentLajesCorporativas:
			return LajesCorporativasPriceToBook, nil
		case SegmentShoppingCenters:
			return ShoppingCentersPriceToBook, nil
		case SegmentGalpoesLogisticos:
			return GalpoesLogisticosPriceToBook, nil
		default:
			return DefaultTijoloPriceToBook, nil
		}
	default:
		return 0, ErrUnknownFairPriceType
	}
}

// TargetPriceToBook é o P/VP a que a cota tende (o "desconto ou ágio
// justo") dado o tipo, o segmento e a Selic do dia:
//
//	yieldExigido = selicAnnualRate + spread      (juro livre de risco + prêmio)
//	yieldNeutro  = selicNeutral + spread
//	P/VP-alvo    = base × (1 − β × (yieldExigido − yieldNeutro) / yieldNeutro)
//
// limitado a [MinTargetPriceToBook, MaxTargetPriceToBook]. Com a Selic na
// neutra devolve o P/VP-base do segmento; Selic acima da neutra exige yield
// maior e reduz o P/VP-alvo, Selic abaixo aumenta. segment vazio ou
// desconhecido usa DefaultTijoloPriceToBook (tijolo); o papel ignora
// segmento. Se yieldNeutro não for positivo, não há desvio relativo a medir e
// devolve o P/VP-base sem ajuste.
func TargetPriceToBook(fiiType Type, segment string, selicAnnualRate, selicNeutral float64) (float64, error) {
	base, err := basePriceToBook(fiiType, segment)
	if err != nil {
		return 0, err
	}

	spread, beta := TijoloRequiredYieldSpread, TijoloPriceToBookBeta
	if fiiType == TypePapel {
		spread, beta = PapelRequiredYieldSpread, PapelPriceToBookBeta
	}

	neutralYield := selicNeutral + spread
	if neutralYield <= 0 {
		return clampTargetPriceToBook(base), nil
	}
	requiredYield := selicAnnualRate + spread
	deviation := (requiredYield - neutralYield) / neutralYield
	return clampTargetPriceToBook(base * (1 - beta*deviation)), nil
}

func clampTargetPriceToBook(v float64) float64 {
	if v < MinTargetPriceToBook {
		return MinTargetPriceToBook
	}
	if v > MaxTargetPriceToBook {
		return MaxTargetPriceToBook
	}
	return v
}

// FairPrice é o preço justo da cota: patrimônio (tijolo) ou valor de carteira
// (papel) por cota, vezes o P/VP-alvo, vezes os efeitos transitórios de preço
// (macroEffectPct e dividendEffectPct, em %, mesma composição multiplicativa
// de bot.FundamentalistFairPrice). baseValue é a mesma grandeza que
// dividend.FIIValuePerShare consome. ok = false quando as cotas, o valor-base
// ou o P/VP-alvo não são positivos (mesmo contrato de "sem dado, não erro" de
// dividend.FIIValuePerShare). Efeitos abaixo de MinPriceEffectPct são
// limitados a ele, então o resultado nunca é negativo.
func FairPrice(baseValue float64, outstandingShares int64, targetPriceToBook, macroEffectPct, dividendEffectPct float64) (float64, bool) {
	if outstandingShares <= 0 || baseValue <= 0 || targetPriceToBook <= 0 {
		return 0, false
	}
	perShare := baseValue / float64(outstandingShares)
	return perShare * targetPriceToBook * (1 + max(macroEffectPct, MinPriceEffectPct)/100) * (1 + max(dividendEffectPct, MinPriceEffectPct)/100), true
}

// BootstrapBaseValueForTargetPrice é a inversa de FairPrice sem efeitos
// transitórios: devolve o patrimônio (ou valor de carteira) total que faz o
// preço justo nascer exatamente em targetPrice, pra qualquer cotas e P/VP-alvo.
// É o que o seed usa pra o FII não sofrer um degrau no primeiro tick (mesma
// razão de fundamentals.BootstrapFinancialsForTargetPrice, achado 003: um
// patrimônio igual a cotas × preço daria P/VP = 1, e o Fundamentalista
// empurraria o preço até o P/VP-alvo do segmento no dia 1). ok = false pra
// entradas não positivas.
func BootstrapBaseValueForTargetPrice(targetPrice float64, outstandingShares int64, targetPriceToBook float64) (float64, bool) {
	if targetPrice <= 0 || outstandingShares <= 0 || targetPriceToBook <= 0 {
		return 0, false
	}
	return targetPrice * float64(outstandingShares) / targetPriceToBook, true
}
