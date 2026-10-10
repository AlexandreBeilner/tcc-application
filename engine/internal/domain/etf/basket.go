package etf

import "errors"

var (
	// ErrMissingConstituentQuantity é devolvido por ConstituentsFromHoldings
	// quando um holding com AssetID preenchido não tem quantidade
	// correspondente em quantities.
	ErrMissingConstituentQuantity = errors.New("quantidade do constituinte não informada")
	// ErrMissingConstituentPrice é devolvido por ConstituentsFromHoldings
	// quando um holding com AssetID preenchido não tem preço correspondente
	// em prices.
	ErrMissingConstituentPrice = errors.New("preço do constituinte não informado")
)

// ConstituentsFromHoldings converte a composição real de um ETF
// (Details.Holdings, tarefa H.4 — cada Holding pode referenciar qualquer
// asset_id do catálogo, Ação/FII/renda fixa) nos Constituent que NAV (H.1)
// consome. Holdings sem AssetID (constituinte puramente cosmético — um nome
// de referência do índice real que não existe no catálogo simulado) são
// ignorados: não têm como entrar no cálculo de NAV, mesma regra documentada
// no comentário de Holding.
//
// Esta função **não decide como cada classe é precificada** — quantities e
// prices, indexados por AssetID, já vêm resolvidos por quem chama (cotação
// de mercado corrente pra Ação/FII, marcação a mercado pra renda fixa) —
// mesmo raciocínio de "domínios irmãos não se importam" já documentado em
// Constituent (nav.go): é isso que faz o critério de aceite de H.4 ("H.1
// precifica cada tipo pela regra correta" pra uma cesta mista) valer de
// verdade pra holdings reais, não só pra Constituent montado à mão em
// teste.
func ConstituentsFromHoldings(holdings []Holding, quantities map[string]int64, prices map[string]float64) ([]Constituent, error) {
	constituents := make([]Constituent, 0, len(holdings))
	for _, h := range holdings {
		if h.AssetID == nil {
			continue
		}

		quantity, ok := quantities[*h.AssetID]
		if !ok {
			return nil, ErrMissingConstituentQuantity
		}
		price, ok := prices[*h.AssetID]
		if !ok {
			return nil, ErrMissingConstituentPrice
		}

		constituents = append(constituents, Constituent{Quantity: quantity, Price: price})
	}

	return constituents, nil
}
