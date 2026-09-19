package etf

import "errors"

var (
	// ErrNoConstituents é devolvido por NAV quando a cesta não tem nenhum
	// constituinte — mesmo raciocínio de ErrNoHoldings (a composição
	// sintética também não pode ser vazia), aqui aplicado à cesta real que
	// sustenta o valor patrimonial do fundo.
	ErrNoConstituents = errors.New("cesta do ETF não pode estar vazia para calcular o NAV")
	// ErrNegativeConstituent é devolvido por NAV quando algum constituinte
	// tem quantidade ou preço negativo — nenhum dos dois tem significado
	// físico (posição negativa não existe; preço de mercado negativo não é
	// um estado que o motor produz).
	ErrNegativeConstituent = errors.New("quantidade e preço de um constituinte da cesta não podem ser negativos")
	// ErrNegativeCashOrLiabilities é devolvido por NAV quando o caixa ou os
	// passivos informados são negativos.
	ErrNegativeCashOrLiabilities = errors.New("caixa e passivos do fundo não podem ser negativos")
	// ErrInvalidSharesOutstanding é devolvido por NAV quando o número de
	// cotas emitidas não é positivo — dividir por zero/negativo não tem
	// resultado válido de valor patrimonial por cota.
	ErrInvalidSharesOutstanding = errors.New("número de cotas emitidas precisa ser maior que zero para calcular o NAV")
)

// Constituent é uma posição da cesta do ETF já precificada pela regra
// correta da própria classe do ativo (proposta motor-mercado-realista 5.5)
// — Quantity × Price é o preço de mercado corrente vezes a quantidade em
// carteira do fundo pra Ação/FII, ou a quantidade de títulos vezes o preço
// marcado a mercado (PU) pra renda fixa. NAV não decide COMO cada classe é
// precificada — só soma o valor já resolvido por quem monta a cesta (H.4
// materializa isso a partir de `etf_holdings`/`orderbook`/marcação a
// mercado reais; até lá, quem chama pode montar o slice a partir de
// qualquer fonte) — mesmo raciocínio de "domínios irmãos não se importam"
// já registrado em bot/allocation.go.
type Constituent struct {
	Quantity int64
	Price    float64
}

// NAV calcula o valor patrimonial por cota de um ETF (proposta 5.1): soma
// do valor de mercado corrente de todos os constituintes da cesta, mais
// caixa, menos passivos, dividido pelo número de cotas emitidas. A mesma
// fórmula serve tanto pro NAV oficial quanto pro iNAV (intradiário,
// recalculável a cada rodada de negociação, D.1) — só muda a frequência de
// quem chama, não o cálculo.
func NAV(constituents []Constituent, cash, liabilities float64, sharesOutstanding int64) (float64, error) {
	if len(constituents) == 0 {
		return 0, ErrNoConstituents
	}
	if sharesOutstanding <= 0 {
		return 0, ErrInvalidSharesOutstanding
	}
	if cash < 0 || liabilities < 0 {
		return 0, ErrNegativeCashOrLiabilities
	}

	basketValue := 0.0
	for _, c := range constituents {
		if c.Quantity < 0 || c.Price < 0 {
			return 0, ErrNegativeConstituent
		}
		basketValue += float64(c.Quantity) * c.Price
	}

	netAssets := basketValue + cash - liabilities
	return netAssets / float64(sharesOutstanding), nil
}
