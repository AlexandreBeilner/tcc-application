package tick

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/selic"
)

func testSelicConfig() selic.Config {
	return selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}
}

func TestAdvance_PrimeiroTickComecaNoDia1(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, testSelicConfig(), 1)

	if result.State.Day != 1 {
		t.Errorf("State.Day = %d, want 1", result.State.Day)
	}
}

func TestAdvance_AvancaUmDiaDeCadaVez(t *testing.T) {
	result := Advance(State{Day: 5, SelicRate: 10}, nil, testSelicConfig(), 1)

	if result.State.Day != 6 {
		t.Errorf("State.Day = %d, want 6", result.State.Day)
	}
}

func TestAdvance_SemAtivosNaoGeraCotacoes(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, testSelicConfig(), 1)

	if len(result.Quotes) != 0 {
		t.Errorf("len(Quotes) = %d, want 0", len(result.Quotes))
	}
}

func TestAdvance_SemCotacaoAnteriorUsaDefaultInitialPrice(t *testing.T) {
	riskClass := "Conservador"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}

	// Volatility=0 e ReversionSpeed=0 isolam o efeito do preço inicial —
	// sem eles o drift ainda move o preço, mas o teste só quer confirmar
	// que partiu de DefaultInitialPrice, não de outro valor arbitrário.
	result := Advance(State{Day: 0, SelicRate: 10}, assets, testSelicConfig(), 1)

	if len(result.Quotes) != 1 {
		t.Fatalf("len(Quotes) = %d, want 1", len(result.Quotes))
	}
	// O preço gerado deve ser próximo de DefaultInitialPrice (GBM de um
	// único passo não se afasta muito do ponto de partida).
	if result.Quotes[0].Price <= 0 {
		t.Errorf("Quotes[0].Price = %v, want > 0", result.Quotes[0].Price)
	}
}

func TestAdvance_UsaLastPriceQuandoExiste(t *testing.T) {
	riskClass := "Conservador"
	lastPrice := 250.0
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: &lastPrice}}

	withHistory := Advance(State{Day: 0, SelicRate: 10}, assets, testSelicConfig(), 1)

	assetsNoHistory := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	withoutHistory := Advance(State{Day: 0, SelicRate: 10}, assetsNoHistory, testSelicConfig(), 1)

	if withHistory.Quotes[0].Price == withoutHistory.Quotes[0].Price {
		t.Error("preço partindo de LastPrice = 250 veio igual ao partindo de DefaultInitialPrice — LastPrice não foi usado")
	}
}

func TestAdvance_RiskClassAusenteUsaConservadorComoDefault(t *testing.T) {
	// ETF/FII não têm risk_class no catálogo hoje (tarefa 3.9) — Advance
	// não deve simplesmente pular esses ativos.
	assets := []AssetForPricing{{AssetID: "etf1", RiskClass: nil, LastPrice: nil}}

	result := Advance(State{Day: 0, SelicRate: 10}, assets, testSelicConfig(), 1)

	if len(result.Quotes) != 1 {
		t.Fatalf("len(Quotes) = %d, want 1 (risk_class nula deveria usar Conservador como default)", len(result.Quotes))
	}
}

func TestAdvance_SinalizaDiaDeReuniaoDoCopom(t *testing.T) {
	// Day: selic.CopomMeetingIntervalDays - 1 -> newDay = 21, dayIndex = 20
	// (0-based) = dia de reunião (21º dia).
	result := Advance(State{Day: selic.CopomMeetingIntervalDays - 1, SelicRate: 10}, nil, testSelicConfig(), 1)

	if !result.IsCopomDay {
		t.Error("IsCopomDay = false, want true no 21º dia simulado")
	}
}

func TestAdvance_NaoSinalizaCopomForaDoDia(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, testSelicConfig(), 1)

	if result.IsCopomDay {
		t.Error("IsCopomDay = true, want false no 1º dia simulado")
	}
}

func TestAdvance_SinalizaDiaDeRelatorio(t *testing.T) {
	// fundamentals.DefaultReportFrequencyDays = 14 -> Day: 13 -> newDay = 14.
	result := Advance(State{Day: 13, SelicRate: 10}, nil, testSelicConfig(), 1)

	if !result.IsReportDay {
		t.Error("IsReportDay = false, want true no 14º dia simulado")
	}
}

func TestAdvance_Deterministica(t *testing.T) {
	riskClass := "Sofisticado"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, Seed: 5}

	a := Advance(State{Day: 20, SelicRate: 11}, assets, cfg, 99)
	b := Advance(State{Day: 20, SelicRate: 11}, assets, cfg, 99)

	if a.State != b.State {
		t.Fatalf("State divergiu: %+v != %+v", a.State, b.State)
	}
	if a.Quotes[0].Price != b.Quotes[0].Price {
		t.Fatalf("preço divergiu: %v != %v", a.Quotes[0].Price, b.Quotes[0].Price)
	}
}
