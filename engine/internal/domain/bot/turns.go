package bot

import (
	"math"
	"math/rand"
)

// Orçamento de turnos por tick (tarefa Q.8, achado 014). Antes da Q.8 cada bot
// sorteava um ativo por rodada, então o custo do tick dependia do tamanho do
// pool e o volume de cada ativo era diluído a cada ativo novo no catálogo. Agora
// o tick fixa quantos turnos de bot acontecem e os distribui entre os ativos; o
// pool só garante diversidade de perfis. Valores ilustrativos, a validar na Q.4.
const (
	// TurnsPerAsset é a média de turnos por ativo por dia enquanto o catálogo é
	// pequeno. O volume que os turnos não dão vem do tamanho da ordem (Q.9).
	TurnsPerAsset = 4
	// MaxTurnsPerTick é o teto de custo: com ~10 a 13 comandos SQL por turno de
	// bot (Q.7, fills e turno de piso incluídos) mais o Market Maker, cerca de 200
	// turnos ficam dentro do teto de 5.000 comandos por tick com 100 ativos (seção
	// 6.1 da proposta de cobertura); acima disso o giro vem do tamanho da ordem.
	MaxTurnsPerTick = 200
	// TurnWithinScopePct é a chance de um turno ser servido por um bot cujo
	// escopo cobre o ativo: o ponto médio da faixa de especialização de um bot
	// (proposta 2.3.2, 85% a 90% da atividade dentro do escopo).
	TurnWithinScopePct = (SpecializationWithinScopeMin + SpecializationWithinScopeMax) / 2
)

// Turn é uma vez que um bot vai negociar um ativo num tick. Floor marca o turno
// de piso do ativo (o primeiro dele no dia): o motor o executa a mercado para
// garantir um negócio de verdade (Q.8, piso rígido de 1 turno por ativo por dia).
type Turn struct {
	AssetID string
	Floor   bool
	// Attention (Q.10) marca o turno de um ativo em atenção por evento: o bot
	// do turno é preferencialmente um Fundamentalista.
	Attention bool
}

// TurnBudget devolve quantos turnos de bot um tick tem para assetCount ativos
// negociáveis: TurnsPerAsset por ativo até MaxTurnsPerTick, e nunca menos que um
// por ativo (o piso rígido vale mesmo num catálogo maior que o teto).
func TurnBudget(assetCount int) int {
	budget := TurnsPerAsset * assetCount
	if budget > MaxTurnsPerTick {
		budget = MaxTurnsPerTick
	}
	if budget < assetCount {
		budget = assetCount
	}
	return budget
}

// AllocateTurns distribui budget turnos entre os ativos de universe: cada ativo
// recebe 1 turno de piso e o resto é repartido pelo peso do ativo (parte
// uniforme mais MarketValueWeight vezes a fração do valor de mercado, o mesmo
// peso da Q.3, vezes a atenção por evento da Q.10). A parte fracionária de cada cota é sorteada por amostragem
// sistemática (o ativo recebe floor ou ceil da cota com probabilidade igual à
// fração), o que fecha a soma exatamente em budget e evita que o mesmo ativo
// receba sempre o mesmo número de turnos dia após dia. Devolve os turnos em
// ordem embaralhada; determinística para uma seed. budget menor que o número de
// ativos é elevado a ele (o piso vem antes do orçamento).
func AllocateTurns(universe []EquityForRound, budget int, rng *rand.Rand) []Turn {
	n := len(universe)
	if n == 0 {
		return nil
	}
	if budget < n {
		budget = n
	}
	extra := budget - n

	var totalValue float64
	for _, e := range universe {
		totalValue += e.MarketValue
	}
	// Peso de cada ativo: parte uniforme mais valor de mercado (Q.3), vezes a
	// atenção por evento (Q.10), normalizado para somar 1.
	weights := make([]float64, n)
	var totalWeight float64
	for i, e := range universe {
		weight := 1 / float64(n)
		if totalValue > 0 {
			weight = (1-MarketValueWeight)/float64(n) + MarketValueWeight*e.MarketValue/totalValue
		}
		if e.Attention > 1 {
			weight *= e.Attention
		}
		weights[i] = weight
		totalWeight += weight
	}

	counts := make([]int, n)
	fractions := make([]float64, n)
	assigned := 0
	for i := range universe {
		quota := float64(extra) * weights[i] / totalWeight
		counts[i] = int(math.Floor(quota))
		fractions[i] = quota - math.Floor(quota)
		assigned += counts[i]
	}

	remaining := extra - assigned
	offset := rng.Float64()
	var cumulative float64
	for i := 0; i < n && remaining > 0; i++ {
		previous := cumulative
		cumulative += fractions[i]
		won := int(math.Ceil(cumulative-offset) - math.Ceil(previous-offset))
		if won > remaining {
			won = remaining
		}
		if won > 0 {
			counts[i] += won
			remaining -= won
		}
	}
	// Resíduo de arredondamento de ponto flutuante: vai para a maior fração.
	for ; remaining > 0; remaining-- {
		best := 0
		for i := range fractions {
			if fractions[i] > fractions[best] {
				best = i
			}
		}
		counts[best]++
		fractions[best] = -1
	}

	turns := make([]Turn, 0, budget)
	for i, e := range universe {
		attention := e.Attention > 1
		turns = append(turns, Turn{AssetID: e.AssetID, Floor: true, Attention: attention})
		for k := 0; k < counts[i]; k++ {
			turns = append(turns, Turn{AssetID: e.AssetID, Attention: attention})
		}
	}
	rng.Shuffle(len(turns), func(i, j int) { turns[i], turns[j] = turns[j], turns[i] })
	return turns
}

// TurnCandidate é um bot elegível para servir turnos: o escopo de especialização
// e o arquétipo (Q.10, para preferir Fundamentalistas em ativos sob atenção).
type TurnCandidate struct {
	Scope     SpecializationScope
	Archetype Archetype
}

// SelectBotForTurn escolhe qual bot serve um turno de asset: TurnWithinScopePct
// das vezes um bot cujo escopo cobre o ativo, o resto um bot de fora (o mesmo
// desenho do sorteio de ativo da Q.3, agora do ponto de vista do ativo). Cai para
// o outro grupo quando o sorteado está vazio. Num turno de ativo sob atenção
// (attention), AttentionFundamentalistShare das vezes só Fundamentalistas
// concorrem (Q.10); sem nenhum Fundamentalista, todos concorrem. Devolve o índice
// em candidates, ou -1 quando não há nenhum bot.
func SelectBotForTurn(asset EquityForRound, candidates []TurnCandidate, attention bool, rng *rand.Rand) int {
	eligible := make([]int, 0, len(candidates))
	if attention && rng.Float64() < AttentionFundamentalistShare {
		for i, c := range candidates {
			if c.Archetype == ArchetypeFundamentalista {
				eligible = append(eligible, i)
			}
		}
	}
	if len(eligible) == 0 {
		for i := range candidates {
			eligible = append(eligible, i)
		}
	}

	var inScope, outOfScope []int
	for _, i := range eligible {
		if candidates[i].Scope.MatchesEquity(asset.Sector, asset.RiskClass, asset.Type) {
			inScope = append(inScope, i)
		} else {
			outOfScope = append(outOfScope, i)
		}
	}

	pool := inScope
	switch {
	case len(inScope) == 0:
		pool = outOfScope
	case len(outOfScope) > 0 && rng.Float64() >= TurnWithinScopePct:
		pool = outOfScope
	}
	if len(pool) == 0 {
		return -1
	}
	return pool[rng.Intn(len(pool))]
}
