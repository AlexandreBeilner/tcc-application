package equity

import (
	"math"
	"testing"
)

func constantSelic(rate float64, steps int) []float64 {
	rates := make([]float64, steps)
	for i := range rates {
		rates[i] = rate
	}
	return rates
}

func TestSeries_DeterministicaPorSeed(t *testing.T) {
	cfg := Config{InitialPrice: 100, RiskClass: RiskClassConservador, SelicAnnualRates: constantSelic(10, 200), Seed: 42}

	a := Series(cfg)
	b := Series(cfg)

	if len(a) != len(b) {
		t.Fatalf("len(a) = %d, len(b) = %d", len(a), len(b))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("série divergiu no índice %d: %v != %v — mesmo seed devia gerar série idêntica", i, a[i], b[i])
		}
	}
}

func TestSeries_SeedsDiferentesGeramSeriesDiferentes(t *testing.T) {
	base := Config{InitialPrice: 100, RiskClass: RiskClassConservador, SelicAnnualRates: constantSelic(10, 100)}

	cfgA := base
	cfgA.Seed = 1
	cfgB := base
	cfgB.Seed = 2

	a := Series(cfgA)
	b := Series(cfgB)

	identical := true
	for i := range a {
		if a[i] != b[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("séries com seeds diferentes vieram idênticas")
	}
}

func TestSeries_ComprimentoIgualAoSelicRates(t *testing.T) {
	cfg := Config{InitialPrice: 100, RiskClass: RiskClassConservador, SelicAnnualRates: constantSelic(10, 37), Seed: 1}

	got := Series(cfg)

	if len(got) != 37 {
		t.Fatalf("len(got) = %d, want 37", len(got))
	}
}

func TestSeries_PrecoNuncaZeroOuNegativo(t *testing.T) {
	cfg := Config{InitialPrice: 50, RiskClass: RiskClassSofisticado, SelicAnnualRates: constantSelic(20, 5000), Seed: 7}

	for i, price := range Series(cfg) {
		if price <= 0 {
			t.Fatalf("prices[%d] = %v, GBM nunca deveria gerar preço <= 0", i, price)
		}
	}
}

func TestSeries_RiskClassDesconhecidaRetornaNil(t *testing.T) {
	cfg := Config{InitialPrice: 100, RiskClass: RiskClass("Inexistente"), SelicAnnualRates: constantSelic(10, 10), Seed: 1}

	if got := Series(cfg); got != nil {
		t.Errorf("Series(risk_class desconhecida) = %v, want nil", got)
	}
}

func TestSeries_SemSelicRatesRetornaNil(t *testing.T) {
	cfg := Config{InitialPrice: 100, RiskClass: RiskClassConservador, SelicAnnualRates: nil, Seed: 1}

	if got := Series(cfg); got != nil {
		t.Errorf("Series(sem Selic) = %v, want nil", got)
	}
}

// TestSeries_VolatilidadeEDriftCoerentesPorRiskClass confere, por amostragem
// grande (lei dos grandes números, determinística porque a seed é fixa —
// não é um teste "flaky"), que a série realizada de cada risk_class converge
// pros parâmetros da tabela da spec 3.2: volatilidade anualizada (σ) e
// drift anual (Selic simulada + prêmio de risco da classe).
func TestSeries_VolatilidadeEDriftCoerentesPorRiskClass(t *testing.T) {
	const steps = 2_000_000
	const selicRate = 10.0 // % a.a., constante nesta amostra pra isolar o efeito da risk_class

	tests := []struct {
		name                   string
		riskClass              RiskClass
		wantAnnualVolatility   float64
		wantAnnualDriftPremium float64
	}{
		{name: "Conservador", riskClass: RiskClassConservador, wantAnnualVolatility: 0.22, wantAnnualDriftPremium: 0.03},
		{name: "Sofisticado", riskClass: RiskClassSofisticado, wantAnnualVolatility: 0.45, wantAnnualDriftPremium: 0.07},
	}

	const tolerance = 0.01 // 1 p.p.; com 2M amostras o erro padrão do drift estimado fica bem abaixo disso

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := Config{InitialPrice: 100, RiskClass: tt.riskClass, SelicAnnualRates: constantSelic(selicRate, steps), Seed: 123}
			prices := Series(cfg)

			logReturns := make([]float64, 0, len(prices))
			prev := cfg.InitialPrice
			for _, p := range prices {
				logReturns = append(logReturns, math.Log(p/prev))
				prev = p
			}

			mean := 0.0
			for _, r := range logReturns {
				mean += r
			}
			mean /= float64(len(logReturns))

			variance := 0.0
			for _, r := range logReturns {
				variance += (r - mean) * (r - mean)
			}
			variance /= float64(len(logReturns))

			realizedAnnualVolatility := math.Sqrt(variance * BusinessDaysPerYear)
			realizedAnnualDrift := mean * BusinessDaysPerYear
			// E[log(S_t+dt/S_t)] de um GBM é (mu - 0.5*sigma²)*dt, não mu*dt —
			// a correção de Itô já embutida na própria Series (gbm.go) —, por
			// isso a comparação usa mu ajustado, não a taxa "nominal" mu.
			wantAnnualDrift := (selicRate/100 + tt.wantAnnualDriftPremium) - 0.5*tt.wantAnnualVolatility*tt.wantAnnualVolatility

			if math.Abs(realizedAnnualVolatility-tt.wantAnnualVolatility) > tolerance {
				t.Errorf("volatilidade anualizada realizada = %v, want ~%v (tolerância %v)", realizedAnnualVolatility, tt.wantAnnualVolatility, tolerance)
			}
			if math.Abs(realizedAnnualDrift-wantAnnualDrift) > tolerance {
				t.Errorf("drift anualizado realizado = %v, want ~%v (tolerância %v)", realizedAnnualDrift, wantAnnualDrift, tolerance)
			}
		})
	}
}

func TestSeries_SofisticadoMaisVolatilQueConservador(t *testing.T) {
	// Mesma seed e mesmo caminho de Selic pros dois — isola o efeito da
	// risk_class isoladamente, sem depender de aleatoriedade favorável.
	const steps = 50_000
	selic := constantSelic(10, steps)

	conservador := Series(Config{InitialPrice: 100, RiskClass: RiskClassConservador, SelicAnnualRates: selic, Seed: 55})
	sofisticado := Series(Config{InitialPrice: 100, RiskClass: RiskClassSofisticado, SelicAnnualRates: selic, Seed: 55})

	stdDevLogReturns := func(prices []float64) float64 {
		prev := 100.0
		returns := make([]float64, len(prices))
		for i, p := range prices {
			returns[i] = math.Log(p / prev)
			prev = p
		}
		mean := 0.0
		for _, r := range returns {
			mean += r
		}
		mean /= float64(len(returns))
		variance := 0.0
		for _, r := range returns {
			variance += (r - mean) * (r - mean)
		}
		return math.Sqrt(variance / float64(len(returns)))
	}

	if stdDevLogReturns(sofisticado) <= stdDevLogReturns(conservador) {
		t.Error("volatilidade realizada de Sofisticado deveria ser maior que a de Conservador")
	}
}
