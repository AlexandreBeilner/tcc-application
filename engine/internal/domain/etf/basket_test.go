package etf

import (
	"errors"
	"math"
	"testing"
)

// TestConstituentsFromHoldings_CestaMistaAcaoFiiRendaFixaPrecificadaCorretamente
// é o teste do critério de aceite de H.4: um ETF pode ter cesta mista
// (Ação + FII + renda fixa) referenciando asset_id real do catálogo, e H.1
// (NAV) precifica cada tipo pela regra correta — aqui simulada pelos mapas
// quantities/prices, que representam preço de mercado corrente (Ação/FII)
// e PU marcado a mercado (renda fixa) já resolvidos por quem monta a cesta
// (mesma regra documentada em Constituent, nav.go).
func TestConstituentsFromHoldings_CestaMistaAcaoFiiRendaFixaPrecificadaCorretamente(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "Mineradora Vale do Rio ON", AssetID: assetID("valr3"), WeightPct: 50},
		{ConstituentName: "FII Tijolo Corporativo", AssetID: assetID("tjlo11"), WeightPct: 30},
		{ConstituentName: "Tesouro Selic 2029", AssetID: assetID("lft2029"), WeightPct: 15},
		// Constituinte cosmético (sem asset_id real) — precisa ser ignorado
		// pelo NAV, nunca gerar erro de quantidade/preço ausente.
		{ConstituentName: "Outros (fora do catálogo)", WeightPct: 5},
	}

	quantities := map[string]int64{
		"valr3":   1000,
		"tjlo11":  500,
		"lft2029": 200,
	}
	prices := map[string]float64{
		"valr3":   25.50,   // preço de mercado corrente (Ação)
		"tjlo11":  110.00,  // preço de mercado corrente (FII)
		"lft2029": 1050.75, // PU marcado a mercado (renda fixa)
	}

	constituents, err := ConstituentsFromHoldings(holdings, quantities, prices)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(constituents) != 3 {
		t.Fatalf("len(constituents) = %d, want 3 (constituinte cosmético não entra)", len(constituents))
	}

	got, err := NAV(constituents, 10_000, 0, 10_000)
	if err != nil {
		t.Fatalf("NAV err = %v, want nil", err)
	}

	want := (1000*25.50 + 500*110.00 + 200*1050.75 + 10_000) / 10_000
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("NAV = %v, want %v", got, want)
	}
}

func TestConstituentsFromHoldings_HoldingSemAssetIDIgnorado(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "Outros", WeightPct: 100},
	}

	got, err := ConstituentsFromHoldings(holdings, nil, nil)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(got) != 0 {
		t.Errorf("len(constituents) = %d, want 0", len(got))
	}
}

func TestConstituentsFromHoldings_QuantidadeAusente(t *testing.T) {
	holdings := []Holding{{ConstituentName: "VALR3", AssetID: assetID("valr3"), WeightPct: 100}}

	_, err := ConstituentsFromHoldings(holdings, nil, map[string]float64{"valr3": 25.50})
	if !errors.Is(err, ErrMissingConstituentQuantity) {
		t.Errorf("err = %v, want ErrMissingConstituentQuantity", err)
	}
}

func TestConstituentsFromHoldings_PrecoAusente(t *testing.T) {
	holdings := []Holding{{ConstituentName: "VALR3", AssetID: assetID("valr3"), WeightPct: 100}}

	_, err := ConstituentsFromHoldings(holdings, map[string]int64{"valr3": 1000}, nil)
	if !errors.Is(err, ErrMissingConstituentPrice) {
		t.Errorf("err = %v, want ErrMissingConstituentPrice", err)
	}
}

// TestPesoDeHoldingRealNaoServeDiretoParaRebalanceOrders_QuandoCestaTemConstituinteCosmetico
// documenta um gap de integração encontrado no teste de ponta a ponta da
// Fase H (achado 006, pontos-em-aberto-decisao-produto.md): Holding.WeightPct
// soma ~100% contando o(s) constituinte(s) cosmético(s) (etf.NewDetails
// exige isso), mas RebalanceOrders (H.2) só enxerga holding com AssetID
// preenchido — se uma sessão futura de integração alimentar
// RebalanceConstituent.TargetWeightPct direto com o WeightPct de
// Details.Holdings (ignorando os cosméticos, mesmo filtro de
// ConstituentsFromHoldings), a soma dos pesos reais fica abaixo de 100% por
// exatamente o peso cosmético excluído, e RebalanceOrders rejeita com
// ErrWeightsDoNotSumTo100. Este teste não prova um bug do código desta
// sessão (H.2/H.3 não têm esse consumidor ainda, achado 006 documenta a
// pendência) — é uma trava viva: se a normalização de peso for esquecida
// quando esse wiring for escrito, este teste já mostra o erro esperado no
// próprio pacote de domínio, sem precisar chegar a um `docker compose up`
// pra descobrir.
func TestPesoDeHoldingRealNaoServeDiretoParaRebalanceOrders_QuandoCestaTemConstituinteCosmetico(t *testing.T) {
	details, err := NewDetails("Índice Misto", "", []Holding{
		{ConstituentName: "VALR3", AssetID: assetID("valr3"), WeightPct: 50},
		{ConstituentName: "TJLO11", AssetID: assetID("tjlo11"), WeightPct: 45},
		// Constituinte cosmético: participa da soma de 100% em NewDetails,
		// mas não tem AssetID — não é utilizável pelo bot mecânico.
		{ConstituentName: "Outros (fora do catálogo)", WeightPct: 5},
	})
	if err != nil {
		t.Fatalf("NewDetails err = %v, want nil", err)
	}

	var reconciliation []RebalanceConstituent
	for _, h := range details.Holdings {
		if h.AssetID == nil {
			continue
		}
		reconciliation = append(reconciliation, RebalanceConstituent{
			AssetID:         *h.AssetID,
			CurrentQuantity: 0,
			Price:           10,
			TargetWeightPct: h.WeightPct, // ingenuamente não renormalizado
		})
	}

	_, err = RebalanceOrders(reconciliation, 0, 0)
	if !errors.Is(err, ErrWeightsDoNotSumTo100) {
		t.Errorf("err = %v, want ErrWeightsDoNotSumTo100 (soma real = 95%%, peso cosmético de 5%% não renormalizado — ver achado 006)", err)
	}
}
