package etf

import (
	"errors"
	"regexp"
	"testing"
)

func validHoldings() []Holding {
	return []Holding{
		{ConstituentName: "PETR4", WeightPct: 40},
		{ConstituentName: "VALE3", WeightPct: 35},
		{ConstituentName: "ITUB4", WeightPct: 25},
	}
}

func TestNewDetails_ValidoComPesosSomando100(t *testing.T) {
	got, err := NewDetails("IBOVESPA", "Replicação física, ponderação por valor de mercado", validHoldings())
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.BenchmarkIndex != "IBOVESPA" {
		t.Errorf("BenchmarkIndex = %q, want %q", got.BenchmarkIndex, "IBOVESPA")
	}
	if len(got.Holdings) != 3 {
		t.Errorf("len(Holdings) = %d, want 3", len(got.Holdings))
	}
}

func TestNewDetails_MethodologySummaryOpcional(t *testing.T) {
	got, err := NewDetails("IBOVESPA", "", validHoldings())
	if err != nil {
		t.Fatalf("err = %v, want nil (methodology_summary é opcional no schema)", err)
	}
	if got.MethodologySummary != "" {
		t.Errorf("MethodologySummary = %q, want vazio", got.MethodologySummary)
	}
}

func TestNewDetails_PesosDentroDaToleranciaSaoAceitos(t *testing.T) {
	tests := []struct {
		name    string
		weights []float64
	}{
		{name: "exatamente 100", weights: []float64{100}},
		{name: "levemente abaixo, dentro da tolerância", weights: []float64{99.7}},
		{name: "levemente acima, dentro da tolerância", weights: []float64{100.3}},
		{name: "no limite exato da tolerância", weights: []float64{100 + WeightTolerance}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			holdings := make([]Holding, len(tt.weights))
			for i, w := range tt.weights {
				holdings[i] = Holding{ConstituentName: "X", WeightPct: w}
			}

			if _, err := NewDetails("IBOVESPA", "", holdings); err != nil {
				t.Errorf("err = %v, want nil", err)
			}
		})
	}
}

func TestNewDetails_PesosForaDaToleranciaSaoRejeitados(t *testing.T) {
	tests := []struct {
		name    string
		weights []float64
	}{
		{name: "muito abaixo de 100", weights: []float64{90}},
		{name: "muito acima de 100", weights: []float64{110}},
		{name: "logo além da tolerância", weights: []float64{100 + WeightTolerance + 0.01}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			holdings := make([]Holding, len(tt.weights))
			for i, w := range tt.weights {
				holdings[i] = Holding{ConstituentName: "X", WeightPct: w}
			}

			_, err := NewDetails("IBOVESPA", "", holdings)
			if !errors.Is(err, ErrWeightsDoNotSumTo100) {
				t.Errorf("err = %v, want ErrWeightsDoNotSumTo100", err)
			}
		})
	}
}

func TestNewDetails_SemIndiceDeReferencia(t *testing.T) {
	_, err := NewDetails("", "metodologia qualquer", validHoldings())
	if !errors.Is(err, ErrMissingBenchmarkIndex) {
		t.Errorf("err = %v, want ErrMissingBenchmarkIndex", err)
	}
}

func TestNewDetails_SemHoldings(t *testing.T) {
	_, err := NewDetails("IBOVESPA", "metodologia qualquer", nil)
	if !errors.Is(err, ErrNoHoldings) {
		t.Errorf("err = %v, want ErrNoHoldings", err)
	}
}

func assetID(id string) *string { return &id }

func TestNewDetails_CestaMistaComEHoldingsSemAssetID(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "VALR3", AssetID: assetID("ativo-acao"), Class: HoldingClassEquity, WeightPct: 40},
		{ConstituentName: "TJLO11", AssetID: assetID("ativo-fii"), Class: HoldingClassFII, WeightPct: 35},
		// Constituinte cosmético (H.4): sem asset_id, continua válido —
		// entra na tela de detalhe, nunca no NAV/rebalanceamento real.
		{ConstituentName: "Outros", WeightPct: 25},
	}

	got, err := NewDetails("Índice Misto", "", holdings)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(got.Holdings) != 3 {
		t.Errorf("len(Holdings) = %d, want 3", len(got.Holdings))
	}
}

func TestNewDetails_AssetIDVazioRejeitado(t *testing.T) {
	empty := ""
	holdings := []Holding{
		{ConstituentName: "X", AssetID: &empty, Class: HoldingClassEquity, WeightPct: 100},
	}

	_, err := NewDetails("IBOVESPA", "", holdings)
	if !errors.Is(err, ErrEmptyHoldingAssetID) {
		t.Errorf("err = %v, want ErrEmptyHoldingAssetID", err)
	}
}

func TestNewDetails_AssetIDDuplicadoRejeitado(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "VALR3 (linha 1)", AssetID: assetID("ativo-acao"), Class: HoldingClassEquity, WeightPct: 50},
		{ConstituentName: "VALR3 (linha 2)", AssetID: assetID("ativo-acao"), Class: HoldingClassEquity, WeightPct: 50},
	}

	_, err := NewDetails("IBOVESPA", "", holdings)
	if !errors.Is(err, ErrDuplicateHoldingAssetID) {
		t.Errorf("err = %v, want ErrDuplicateHoldingAssetID", err)
	}
}

func TestNewDetails_VariosHoldingsSemAssetIDNaoContamComoDuplicata(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "Outros 1", WeightPct: 50},
		{ConstituentName: "Outros 2", WeightPct: 50},
	}

	if _, err := NewDetails("IBOVESPA", "", holdings); err != nil {
		t.Errorf("err = %v, want nil (dois holdings sem asset_id não são duplicata entre si)", err)
	}
}

func TestNewDetails_ConstituenteDeClasseNaoNegociavelRejeitado(t *testing.T) {
	tests := []struct {
		name    string
		class   HoldingClass
		wantErr error
	}{
		{name: "renda fixa", class: HoldingClassFixedIncome, wantErr: ErrNonTradableConstituent},
		{name: "outro ETF", class: HoldingClassETF, wantErr: ErrNonTradableConstituent},
		{name: "classe desconhecida", class: HoldingClass("cripto"), wantErr: ErrNonTradableConstituent},
		{name: "classe ausente", class: "", wantErr: ErrMissingHoldingClass},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			holdings := []Holding{
				{ConstituentName: "VALR3", AssetID: assetID("ativo-acao"), Class: HoldingClassEquity, WeightPct: 85},
				{ConstituentName: "Outro", AssetID: assetID("ativo-x"), Class: tt.class, WeightPct: 15},
			}

			_, err := NewDetails("Índice Misto", "", holdings)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewDetails_ConstituenteCosmeticoNaoPrecisaDeClasse(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "VALR3", AssetID: assetID("ativo-acao"), Class: HoldingClassEquity, WeightPct: 90},
		{ConstituentName: "Outros", WeightPct: 10},
	}

	if _, err := NewDetails("Índice Misto", "", holdings); err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestFundAccountID(t *testing.T) {
	uuidPattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

	a := FundAccountID("11111111-1111-1111-1111-111111111111")
	if !uuidPattern.MatchString(a) {
		t.Errorf("FundAccountID = %q, want uuid bem formado", a)
	}
	if again := FundAccountID("11111111-1111-1111-1111-111111111111"); again != a {
		t.Errorf("FundAccountID não é determinístico: %q != %q", again, a)
	}
	if other := FundAccountID("22222222-2222-2222-2222-222222222222"); other == a {
		t.Errorf("ETFs diferentes geraram a mesma conta de fundo: %q", a)
	}
}
