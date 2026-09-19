// Package bot — dispatcher de decisão por arquétipo + seleção de ativo
// dentro/fora do escopo (tarefa D.2, backlog-motor-mercado-realista) — a
// peça que uma rodada de negociação (Fase D, orquestrada por tick.Service,
// já que exige leitura ao vivo de caixa/posição/preço) usa pra não precisar
// conhecer os 4 arquétipos individualmente: monta um DecisionInput genérico
// e chama Decide, que despacha pra DecideNoiseOrder/DecideMarketMakerOrders/
// DecideChartistOrder/DecideFundamentalistOrder (C.2-C.5) conforme
// personality.Archetype.
package bot

import (
	"errors"
	"math/rand"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
)

// ErrNoEquityAvailable é devolvido por SelectAssetForRound quando universe
// está vazio — não há nenhum ativo pra negociar nesta rodada (ainda sem
// nenhuma Ação no catálogo, por exemplo).
var ErrNoEquityAvailable = errors.New("nenhum ativo disponível pra sortear nesta rodada")

// EquityForRound é o insumo mínimo de um ativo de Renda Variável que
// SelectAssetForRound precisa pra checar se ele cai dentro do escopo de um
// bot — CompanyID/preço/histórico/fundamentos ficam a cargo de quem orquestra
// a rodada (tick.Service, Fase D.2), este pacote só decide "cai no escopo ou
// não". Type (tarefa G.1) é a classe de ativo crua (catalog.AssetAcao/
// AssetETF/AssetFII) — zero value "" pra quem construía EquityForRound antes
// da G.1 sem se importar com este campo (mesma tolerância a zero value já
// dada a Sector/RiskClass).
type EquityForRound struct {
	AssetID   string
	Sector    catalog.Sector
	RiskClass equity.RiskClass
	Type      catalog.AssetType
}

// MatchesEquity confere se o escopo de especialização do bot alcança um
// ativo de Renda Variável com o setor/risk_class/classe de ativo dados —
// união (não XOR, mesma semântica de NewSpecializationScope/C.1): basta um
// dos três bater. Mesmo raciocínio de fan-out de macroevent.Target/
// tick.eventTargetsAsset, aqui pro escopo de bot em vez de alvo de evento
// macro. Ação nunca bate pela checagem de AssetClasses (C.6: "Ação não é uma
// chave de cobertura própria... setor já cobre Ação por construção" — nenhum
// bot carrega catalog.AssetAcao no próprio escopo), mas FII (tarefa G.1) não
// tem setor nem risk_class própria (spec 3.6) — pra ele, AssetClasses é a
// única via de match possível. ETF (Fase H) vai depender do mesmo mecanismo
// quando entrar no motor de rodada.
func (s SpecializationScope) MatchesEquity(sector catalog.Sector, riskClass equity.RiskClass, assetType catalog.AssetType) bool {
	for _, sc := range s.Sectors {
		if sc == sector {
			return true
		}
	}
	for _, rc := range s.RiskClasses {
		if rc == riskClass {
			return true
		}
	}
	for _, ac := range s.AssetClasses {
		if ac == assetType {
			return true
		}
	}
	return false
}

// SelectAssetForRound sorteia, pra um bot nesta rodada, qual ativo de
// universe ele vai negociar: WithinScopePct das vezes um ativo uniformemente
// sorteado dentre os que MatchesEquity aprova (proposta 2.3.2: "85-90% da
// atividade dentro do escopo"), o restante um ativo fora dele — garantindo
// que nenhum ativo fique sem liquidez nenhuma só por estar fora do escopo de
// todo mundo. Cai pro outro grupo quando o sorteado está vazio (bot cujo
// escopo não bate com nenhum ativo do universo atual, ou cujo escopo cobre
// universe inteiro — ex: Market Maker, C.6 — não tem "fora do escopo" pra
// cair). Devolve ErrNoEquityAvailable só quando universe está vazio (nada
// pra negociar, nenhum sorteio possível).
func SelectAssetForRound(scope SpecializationScope, universe []EquityForRound, rng *rand.Rand) (EquityForRound, error) {
	if len(universe) == 0 {
		return EquityForRound{}, ErrNoEquityAvailable
	}

	var inScope, outOfScope []EquityForRound
	for _, e := range universe {
		if scope.MatchesEquity(e.Sector, e.RiskClass, e.Type) {
			inScope = append(inScope, e)
		} else {
			outOfScope = append(outOfScope, e)
		}
	}

	pool := inScope
	switch {
	case len(inScope) == 0:
		pool = outOfScope
	case len(outOfScope) > 0 && rng.Float64() >= scope.WithinScopePct:
		pool = outOfScope
	}

	return pool[rng.Intn(len(pool))], nil
}

// DecisionInput agrupa todo insumo que algum arquétipo pode precisar pra
// decidir uma ordem — Decide só repassa os campos que o arquétipo de
// personality de fato consome pra sua função Decide* específica (C.2-C.5),
// os demais ficam ignorados (ex: Financials/GrowthRate não fazem sentido
// pro Ruído). Quem orquestra a rodada (tick.Service, Fase D.2) monta um
// valor só, igual pros 4 arquétipos, sem precisar saber qual campo cada um
// usa.
type DecisionInput struct {
	ReferencePrice    float64
	PriceHistory      []float64
	AvailableCash     float64
	CurrentPosition   int
	Financials        fundamentals.Financials
	OutstandingShares int64
	GrowthRate        float64
	// MacroEffectPct (tarefa E.2) só é consumido pelo arquétipo
	// Fundamentalista (ver DecideFundamentalistOrder) — o sinal/magnitude
	// bruto (por alvo, E.1) de qualquer evento macro ativo que atinge a
	// empresa deste ativo, 0 quando nenhum. Ignorado pelos demais 3
	// arquétipos, mesmo tratamento já dado a Financials/GrowthRate.
	MacroEffectPct  float64
	SelicAnnualRate float64
	SelicNeutral    float64
	RiskClass       equity.RiskClass
	Seed            int64
	// OrderSizeCeiling (achado 005, pontos-em-aberto-decisao-produto.md) é
	// o teto de tamanho de ordem de compra repassado aos 4 arquétipos
	// (capToFloat, marketmaker.go) — nil quando nenhum teto se aplica (ex:
	// sandbox). Composto por tick.decisionInputFor como o menor entre o
	// float finito do ativo (o antigo FloatCeiling, sozinho até a correção
	// de 2026-09-19: sem ele, o caixa acumulado de um bot ao longo de
	// muitos ciclos gerava ordens de compra maiores que 100% do float,
	// nunca preenchíveis) e o volume médio negociado recente (parte B da
	// mesma correção: 100% do float ainda era um teto gigante, sem relação
	// com o que o mercado de fato absorve) — nenhum dos 4 arquétipos
	// precisa saber de onde o teto veio, só que não pode ser excedido.
	OrderSizeCeiling *int64
}

// Decide despacha pra função de decisão do arquétipo de personality
// (DecideNoiseOrder/DecideMarketMakerOrders/DecideChartistOrder/
// DecideFundamentalistOrder, C.2-C.5), normalizando o retorno pra
// []Decision (Market Maker já devolve vários; os demais devolvem um só,
// aqui embrulhado num slice de tamanho 1) — ponto único que a coleta de
// decisões de uma rodada (Fase D.2) chama, sem precisar de um switch
// próprio por arquétipo. Qualquer erro devolvido pelas funções de decisão
// (ErrNoViableOrder, ErrNoClearTrend, ErrNoMispricingDetected,
// ErrInsufficientPriceHistory, ...) propaga sem tradução — são sinais de
// "este bot não participa desta rodada", não falhas de programação (ver doc
// de cada Decide* em C.2-C.5).
func Decide(personality Personality, input DecisionInput) ([]Decision, error) {
	switch personality.Archetype {
	case ArchetypeRuido:
		d, err := DecideNoiseOrder(input.ReferencePrice, input.AvailableCash, input.CurrentPosition, input.Seed, input.OrderSizeCeiling)
		if err != nil {
			return nil, err
		}
		return []Decision{d}, nil
	case ArchetypeMarketMaker:
		return DecideMarketMakerOrders(personality, input.ReferencePrice, input.AvailableCash, input.CurrentPosition, input.OrderSizeCeiling)
	case ArchetypeChartista:
		d, err := DecideChartistOrder(personality, input.PriceHistory, input.AvailableCash, input.CurrentPosition, input.OrderSizeCeiling)
		if err != nil {
			return nil, err
		}
		return []Decision{d}, nil
	case ArchetypeFundamentalista:
		d, err := DecideFundamentalistOrder(
			personality, input.Financials, input.OutstandingShares, input.GrowthRate, input.MacroEffectPct,
			input.ReferencePrice, input.SelicAnnualRate, input.SelicNeutral, input.RiskClass,
			input.AvailableCash, input.CurrentPosition, input.Seed, input.OrderSizeCeiling,
		)
		if err != nil {
			return nil, err
		}
		return []Decision{d}, nil
	default:
		return nil, ErrUnknownArchetype
	}
}
