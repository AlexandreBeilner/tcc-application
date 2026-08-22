package fixedincome

import (
	"math"
	"testing"
)

// Cenário comum aos testes: título comprado com taxa de 10% a.a. e prazo
// de 252 DU (1 ano útil), resgatado antecipadamente na metade do prazo
// (126 DU restantes) — só a taxa de mercado no dia do resgate varia.
const (
	purchaseRate  = 0.10
	purchaseTerm  = 252
	remainingTerm = 126
)

var purchasePrice = PrefixedPrice(purchaseRate, purchaseTerm)

func TestEarlyRedemption_TaxaSubiu_RentabilidadeInferiorAContratada(t *testing.T) {
	// TCC cap. 2.2.3: se a taxa de mercado sobe acima da contratada, o
	// título fica menos atraente que os novos e sofre desvalorização —
	// rentabilidade inferior à contratada (não necessariamente prejuízo).
	got := EarlyRedemption(purchasePrice, purchaseRate, 0.15, remainingTerm)

	if got.VsContractedRate >= 0 {
		t.Errorf("VsContractedRate = %v, want negativo (perda em relação à taxa contratada)", got.VsContractedRate)
	}
	if got.RealizedReturnPct <= 0 {
		t.Errorf("RealizedReturnPct = %v, want positivo (ainda houve valorização, só que menor)", got.RealizedReturnPct)
	}
}

func TestEarlyRedemption_TaxaCaiu_GanhoExtraordinario(t *testing.T) {
	// TCC cap. 2.2.3: se a taxa de mercado cai abaixo da contratada, o
	// título antigo fica mais disputado e valoriza — ganho extraordinário.
	got := EarlyRedemption(purchasePrice, purchaseRate, 0.06, remainingTerm)

	if got.VsContractedRate <= 0 {
		t.Errorf("VsContractedRate = %v, want positivo (ganho extraordinário)", got.VsContractedRate)
	}
}

func TestEarlyRedemption_TaxaInalterada_SemDesvioDoContratado(t *testing.T) {
	got := EarlyRedemption(purchasePrice, purchaseRate, purchaseRate, remainingTerm)

	if math.Abs(got.VsContractedRate) >= 0.01 {
		t.Errorf("VsContractedRate = %v, want ≈0 (taxa de mercado não mudou)", got.VsContractedRate)
	}
}

func TestEarlyRedemption_RentabilidadeCresceQuandoTaxaCai(t *testing.T) {
	// Quanto menor a taxa de mercado no resgate, maior o retorno realizado
	// — a ordem entre os três cenários do TCC precisa ser monotônica.
	subiu := EarlyRedemption(purchasePrice, purchaseRate, 0.15, remainingTerm)
	igual := EarlyRedemption(purchasePrice, purchaseRate, 0.10, remainingTerm)
	caiu := EarlyRedemption(purchasePrice, purchaseRate, 0.06, remainingTerm)

	if !(subiu.RealizedReturnPct < igual.RealizedReturnPct && igual.RealizedReturnPct < caiu.RealizedReturnPct) {
		t.Errorf("retornos fora de ordem: subiu=%v, igual=%v, caiu=%v",
			subiu.RealizedReturnPct, igual.RealizedReturnPct, caiu.RealizedReturnPct)
	}
}

func TestEarlyRedemption_ValoresExatos(t *testing.T) {
	tests := []struct {
		name              string
		currentMarketRate float64
		wantMarkPrice     float64
		wantRealizedPct   float64
		wantVsContracted  float64
	}{
		{"taxa subiu pra 15%", 0.15, 932.5048, 2.5755, -20.9578},
		{"taxa caiu pra 6%", 0.06, 971.2859, 6.8414, 17.8233},
		{"taxa inalterada em 10%", 0.10, 953.4626, 4.8809, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EarlyRedemption(purchasePrice, purchaseRate, tt.currentMarketRate, remainingTerm)

			if math.Abs(got.MarkToMarketPrice-tt.wantMarkPrice) >= 0.01 {
				t.Errorf("MarkToMarketPrice = %v, want %v", got.MarkToMarketPrice, tt.wantMarkPrice)
			}
			if math.Abs(got.RealizedReturnPct-tt.wantRealizedPct) >= 0.01 {
				t.Errorf("RealizedReturnPct = %v, want %v", got.RealizedReturnPct, tt.wantRealizedPct)
			}
			if math.Abs(got.VsContractedRate-tt.wantVsContracted) >= 0.01 {
				t.Errorf("VsContractedRate = %v, want %v", got.VsContractedRate, tt.wantVsContracted)
			}
		})
	}
}
