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
	"crypto/sha1"
	"errors"
	"fmt"
	"math"
)

var (
	ErrMissingBenchmarkIndex   = errors.New("índice de referência é obrigatório para um ETF")
	ErrNoHoldings              = errors.New("composição sintética do ETF não pode ser vazia")
	ErrWeightsDoNotSumTo100    = errors.New("peso dos constituintes não soma ~100%")
	ErrEmptyHoldingAssetID     = errors.New("asset_id de um constituinte, quando informado, não pode ser vazio")
	ErrDuplicateHoldingAssetID = errors.New("mesmo asset_id referenciado por mais de um constituinte da cesta")
	// ErrNonTradableConstituent é devolvido por NewDetails quando um
	// constituinte real (com AssetID) é de uma classe que o ETF negociável
	// não aceita: renda fixa (decisão do autor de 2026-09-26, tarefa R.1 —
	// precisa de marcação a mercado a cada rodada e de criação/resgate em
	// instrumento sem book, ver R.13) ou outro ETF (cesta de ETFs não tem
	// significado na primeira versão).
	ErrNonTradableConstituent = errors.New("constituinte de ETF negociável precisa ser Ação ou FII")
	// ErrMissingHoldingClass é devolvido por NewDetails quando um
	// constituinte real chega sem a classe do ativo: sem ela a regra de
	// ErrNonTradableConstituent não tem como ser aplicada.
	ErrMissingHoldingClass = errors.New("classe do constituinte é obrigatória quando asset_id é informado")
)

// Defaults dos termos do fundo (tarefa R.1, migration 000026): valores
// ilustrativos, mesma calibração fina da tarefa 8.1 que se aplica a todo
// coeficiente sem tabela numérica fechada. A frequência de rebalanceamento
// acompanha o ciclo de relatório de 91 dias simulados, rebalanceamento
// trimestral (R.7, S.2).
const (
	DefaultExpenseRatioPct        = 0.50
	DefaultRebalanceFrequencyDays = 91
)

// HoldingClass é a classe do ativo que um Holding com AssetID referencia,
// resolvida por quem monta a cesta (o seed lê de `assets.type`) — o
// pacote etf não importa catalog (mesma convenção de "domínios irmãos não
// se importam"). Só Ação e FII formam uma cesta negociável (tarefa R.1).
type HoldingClass string

const (
	HoldingClassEquity      HoldingClass = "acao"
	HoldingClassFII         HoldingClass = "fii"
	HoldingClassFixedIncome HoldingClass = "renda_fixa"
	HoldingClassETF         HoldingClass = "etf"
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
	// Class só é lida por NewDetails (validação de escrita) e só quando
	// AssetID está preenchido; uma composição relida do banco
	// (FindETFDetails) não a preenche.
	Class     HoldingClass
	WeightPct float64
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
// mesmo ativo em duas linhas separadas). Desde a tarefa R.1, um constituinte
// real também precisa declarar a Class do ativo e ela só pode ser Ação ou
// FII (ErrMissingHoldingClass, ErrNonTradableConstituent). MethodologySummary não é validado
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
		if h.Class == "" {
			return Details{}, ErrMissingHoldingClass
		}
		if h.Class != HoldingClassEquity && h.Class != HoldingClassFII {
			return Details{}, ErrNonTradableConstituent
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

// FundAccountID deriva o user_id (uuid) da conta de fundo de um ETF a partir
// do asset_id dele (tarefa R.1): determinístico, então reexecutar o seed
// reencontra a mesma conta em vez de criar uma segunda, e sem colisão com os
// uuids de bot (`00000000-...`) nem com uuids de usuário real. O prefixo
// funciona como namespace (mesma ideia de um uuid v5, sem depender de
// biblioteca externa); a versão/variante são fixadas só pra o resultado ser um
// uuid bem formado.
func FundAccountID(etfAssetID string) string {
	sum := sha1.Sum([]byte("etf-fund-account:" + etfAssetID))
	sum[6] = (sum[6] & 0x0f) | 0x50
	sum[8] = (sum[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", sum[0:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
}
