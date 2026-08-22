// Package etf modela a especialização de ETFs (`etf_details` +
// `etf_holdings`, spec 3.6, RF21): diferente de uma ação individual, um
// ETF não tem indicadores fundamentalistas de empresa — em vez disso,
// exibe o índice de referência que replica, a metodologia de replicação e
// uma composição sintética simplificada (principais constituintes e peso
// percentual).
package etf

import (
	"errors"
	"math"
)

var (
	ErrMissingBenchmarkIndex = errors.New("índice de referência é obrigatório para um ETF")
	ErrNoHoldings            = errors.New("composição sintética do ETF não pode ser vazia")
	ErrWeightsDoNotSumTo100  = errors.New("peso dos constituintes não soma ~100%")
)

// WeightTolerance é a margem aceita em torno de 100% pra soma dos pesos da
// composição sintética, em pontos percentuais — folga pro arredondamento
// de `weight_pct numeric(5,2)` e porque a spec 3.6 já fala em "peso
// somando ~100%", não exatamente 100%.
const WeightTolerance = 0.5

// Holding é um constituinte da composição sintética de um ETF — um dos
// principais ativos/empresas do índice replicado e seu peso percentual
// (spec 3.6).
type Holding struct {
	ConstituentName string
	WeightPct       float64
}

// Details é a especialização de um ETF (spec 3.6, RF21): o índice de
// referência replicado, um resumo da metodologia de replicação, e a
// composição sintética — os dados que substituem indicadores
// fundamentalistas de empresa individual na tela de detalhe de ativo pra
// essa classe.
type Details struct {
	BenchmarkIndex     string
	MethodologySummary string
	Holdings           []Holding
}

// NewDetails monta a especialização de um ETF, validando as duas regras
// de negócio da tarefa 3.7: precisa de um índice de referência associado
// (critério de aceite "cada ETF tem um índice associado"), e a composição
// sintética precisa somar ~100% dentro de WeightTolerance (critério de
// aceite "lista de constituintes com peso somando ~100%").
// MethodologySummary não é validado — é opcional, o mesmo NULL permitido
// por `etf_details.methodology_summary` no schema.
func NewDetails(benchmarkIndex, methodologySummary string, holdings []Holding) (Details, error) {
	if benchmarkIndex == "" {
		return Details{}, ErrMissingBenchmarkIndex
	}
	if len(holdings) == 0 {
		return Details{}, ErrNoHoldings
	}

	totalWeight := 0.0
	for _, h := range holdings {
		totalWeight += h.WeightPct
	}
	if math.Abs(totalWeight-100) > WeightTolerance {
		return Details{}, ErrWeightsDoNotSumTo100
	}

	return Details{
		BenchmarkIndex:     benchmarkIndex,
		MethodologySummary: methodologySummary,
		Holdings:           holdings,
	}, nil
}
