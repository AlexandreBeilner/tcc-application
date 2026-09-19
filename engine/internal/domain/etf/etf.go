// Package etf modela a especialização de ETFs (`etf_details` +
// `etf_holdings`, spec 3.6, RF21): diferente de uma ação individual, um
// ETF não tem indicadores fundamentalistas de empresa — em vez disso,
// exibe o índice de referência que replica, a metodologia de replicação e
// uma composição sintética simplificada (principais constituintes e peso
// percentual). Desde a tarefa H.4 (proposta motor-mercado-realista 5.5),
// um Holding pode também referenciar um asset_id real do catálogo — Ação,
// FII ou instrumento de renda fixa, qualquer classe — o que o torna
// utilizável pelo motor de bot (H.2 rebalanceamento, H.3 Participante
// Autorizado) e pelo cálculo de NAV (H.1), não só pela tela de detalhe.
package etf

import (
	"errors"
	"math"
)

var (
	ErrMissingBenchmarkIndex   = errors.New("índice de referência é obrigatório para um ETF")
	ErrNoHoldings              = errors.New("composição sintética do ETF não pode ser vazia")
	ErrWeightsDoNotSumTo100    = errors.New("peso dos constituintes não soma ~100%")
	ErrEmptyHoldingAssetID     = errors.New("asset_id de um constituinte, quando informado, não pode ser vazio")
	ErrDuplicateHoldingAssetID = errors.New("mesmo asset_id referenciado por mais de um constituinte da cesta")
)

// WeightTolerance é a margem aceita em torno de 100% pra soma dos pesos da
// composição sintética, em pontos percentuais — folga pro arredondamento
// de `weight_pct numeric(5,2)` e porque a spec 3.6 já fala em "peso
// somando ~100%", não exatamente 100%.
const WeightTolerance = 0.5

// Holding é um constituinte da composição de um ETF — um dos principais
// ativos/empresas do índice replicado e seu peso percentual (spec 3.6).
// AssetID é nulo pra um constituinte puramente cosmético (ex: um nome de
// referência do índice real que o ETF replica, mas que não existe no
// catálogo simulado desta plataforma — "Outros", ou uma empresa real fora
// do catálogo) — esse tipo de constituinte entra na tela de detalhe (RF21)
// mas nunca no cálculo de NAV real (H.1) nem nas ordens do bot mecânico
// (H.2/H.3), que só enxergam holdings com AssetID preenchido. Quando
// preenchido, referencia qualquer asset_id do catálogo — Ação, FII, ETF ou
// instrumento de renda fixa (tarefa H.4, proposta 5.5) — nunca só
// constituinte de renda variável como a composição nasceu antes desta
// tarefa.
type Holding struct {
	ConstituentName string
	AssetID         *string
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

// NewDetails monta a especialização de um ETF, validando as regras de
// negócio da tarefa 3.7 (índice de referência obrigatório; peso somando
// ~100% dentro de WeightTolerance) e, desde a tarefa H.4, as regras sobre
// AssetID: quando informado não pode ser string vazia
// (ErrEmptyHoldingAssetID), e o mesmo asset_id não pode aparecer em mais
// de um constituinte (ErrDuplicateHoldingAssetID — um fundo não detém o
// mesmo ativo em duas linhas separadas). MethodologySummary não é validado
// — é opcional, o mesmo NULL permitido por `etf_details.methodology_summary`
// no schema.
func NewDetails(benchmarkIndex, methodologySummary string, holdings []Holding) (Details, error) {
	if benchmarkIndex == "" {
		return Details{}, ErrMissingBenchmarkIndex
	}
	if len(holdings) == 0 {
		return Details{}, ErrNoHoldings
	}

	totalWeight := 0.0
	seenAssetIDs := make(map[string]bool, len(holdings))
	for _, h := range holdings {
		totalWeight += h.WeightPct
		if h.AssetID == nil {
			continue
		}
		if *h.AssetID == "" {
			return Details{}, ErrEmptyHoldingAssetID
		}
		if seenAssetIDs[*h.AssetID] {
			return Details{}, ErrDuplicateHoldingAssetID
		}
		seenAssetIDs[*h.AssetID] = true
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
