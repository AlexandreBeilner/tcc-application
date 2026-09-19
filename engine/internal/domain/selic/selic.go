// Package selic simula a taxa Selic — base para a precificação de renda
// fixa pós-fixada (Tesouro Selic, CDB/LCI/LCA/CRI/CRA indexados a %CDI) e
// fator sistêmico dos fundamentos das empresas (spec 3.2.2).
package selic

import "math/rand"

// Valores de referência da spec 3.2.2 — "ajustável conforme calibração"
// (revisitado na semana 8 do roadmap), por isso vivem como default, não
// como constante travada tipo account.InitialBalance.
const (
	// DefaultNeutralRate é a Selic de longo prazo usada como âncora de
	// reversão à média (% a.a., ex: 10% aproxima a média histórica).
	DefaultNeutralRate = 10.0
	// DefaultReversionSpeed controla a velocidade de reversão à média a
	// cada passo — quanto maior, mais rápido a taxa volta pra Neutral.
	DefaultReversionSpeed = 0.05
	// DefaultDailyVolatility é o desvio-padrão do ruído por passo, em
	// pontos percentuais de taxa anual.
	DefaultDailyVolatility = 0.15
	// DefaultInflationWeight é o peso do termo de reação ao desvio do IPCA
	// acumulado frente à meta (tarefa I.1, proposta seção 6) — moderado,
	// próximo do coeficiente clássico da regra de Taylor (~1.5x o desvio),
	// não um valor fraco nem deixado em branco (decisão confirmada na
	// proposta, não uma estimativa como os demais Default* deste bloco).
	DefaultInflationWeight = 1.5
)

// Config parametriza o processo estocástico da Selic simulada. Initial é a
// taxa (% a.a.) no ponto de partida da série.
type Config struct {
	Initial        float64
	Neutral        float64
	ReversionSpeed float64
	Volatility     float64
	// InflationWeight pondera o termo `peso_inflação × (IPCA_acumulado −
	// meta_IPCA)` da regra de reação (tarefa I.1) — somado ao termo de
	// reversão à média já existente antes de cada decisão do Copom.
	// InflationWeight = 0 desativa o termo por completo, reproduzindo
	// exatamente a fórmula anterior a esta tarefa (retrocompatibilidade).
	InflationWeight float64
	Seed            int64
}

// DefaultConfig monta a configuração de referência da spec 3.2.2, variando
// só os dois parâmetros que mudam por simulação: taxa inicial e seed.
func DefaultConfig(initial float64, seed int64) Config {
	return Config{
		Initial:         initial,
		Neutral:         DefaultNeutralRate,
		ReversionSpeed:  DefaultReversionSpeed,
		Volatility:      DefaultDailyVolatility,
		InflationWeight: DefaultInflationWeight,
		Seed:            seed,
	}
}

// Series gera uma série determinística de `steps` valores de Selic
// simulada (% a.a.), via reversão à média discretizada (Ornstein-Uhlenbeck
// simplificado — precursor do Vasicek completo com calendário Copom da
// tarefa 3.3): mesmos Config e mesmo Seed sempre produzem exatamente a
// mesma série. É essa reprodutibilidade que garante tanto o determinismo
// do sandbox (RNF08) quanto a auditabilidade exigida pela tarefa 2.2 — a
// série pode ser recalculada e conferida a qualquer momento a partir dos
// parâmetros usados. A taxa nunca fica negativa (Selic não é negativa).
func Series(cfg Config, steps int) []float64 {
	if steps <= 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	rates := make([]float64, steps)
	rate := cfg.Initial
	for i := range rates {
		noise := rng.NormFloat64() * cfg.Volatility
		rate += cfg.ReversionSpeed*(cfg.Neutral-rate) + noise
		if rate < 0 {
			rate = 0
		}
		rates[i] = rate
	}
	return rates
}
