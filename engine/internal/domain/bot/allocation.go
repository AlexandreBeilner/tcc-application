// Package bot contém o domínio dos bots de liquidez do Mercado Ao Vivo
// (proposta motor-mercado-realista, seção 2) — contas is_bot (account.NewBot,
// tarefa A.1) que substituem a liquidez sintética revertida na tarefa A.2,
// negociando dos dois lados do book. Esta primeira peça (tarefa B.1) só
// resolve a distribuição inicial do float finito (tarefa A.3) entre esses
// bots — antes de qualquer personalidade (arquétipo, escopo de
// especialização, nível de conhecimento) existir, isso é escopo da Fase C.
package bot

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"sort"
)

// MarketMakerShareMin/MarketMakerShareMax são a faixa confirmada na
// proposta 2.2 pra fatia do grupo Market Maker sobre o float total de um
// ativo. InitialAllocation rejeita qualquer marketMakerSharePct fora dessa
// faixa — o critério de aceite "Market Maker sempre dentro da faixa 40-60%"
// é garantido por essa validação, não por sorteio: quem decide o valor
// exato dentro da faixa é o chamador (seed, tarefa B.2), este pacote só
// impede um valor fora dela.
const (
	MarketMakerShareMin = 0.40
	MarketMakerShareMax = 0.60
)

// ErrInvalidAllocation é devolvido por InitialAllocation quando os
// parâmetros não formam uma distribuição válida.
var ErrInvalidAllocation = errors.New("distribuição inicial de float inválida")

// Allocation é o resultado de InitialAllocation: quantas ações/cotas do
// float de um ativo cada bot recebe no seed — tarefa B.2 consome isso pra
// popular `positions` (mesma unidade inteira de
// catalog.VariableIncome.OutstandingShares, *int64).
type Allocation struct {
	// MarketMaker é o total de ações do grupo Market Maker (proposta 2.2)
	// — um único agregado aqui porque nesta tarefa (B.1) o Market Maker
	// ainda não existe como uma ou mais contas individuais concretas (isso
	// é decisão de catálogo, tarefa C.6); quem chama decide como fatiar
	// esse total entre as contas de Market Maker que existirem.
	MarketMaker int64
	// Others é a fatia de cada um dos demais bots (nunca inclui o Market
	// Maker), na mesma ordem em que otherBotCount foi pedido — não carrega
	// identidade de bot, só posição no slice; quem chama associa cada
	// índice a uma conta concreta (B.2).
	Others []int64
}

// InitialAllocation distribui o float finito de um ativo (totalFloat, o
// outstanding_shares do catálogo) entre o grupo Market Maker e
// otherBotCount outros bots (proposta 2.2): o Market Maker recebe a fatia
// mais próxima possível de marketMakerSharePct que ainda seja uma
// quantidade inteira de ações dentro de MarketMakerShareMin/Max — nunca uma
// fatia fora da faixa, mesmo quando arredondar marketMakerSharePct*totalFloat
// diretamente estouraria ela (totalFloat pequeno); quando nenhum inteiro
// respeita a faixa, devolve ErrInvalidAllocation em vez de uma alocação
// inválida. O restante se distribui entre os demais por pesos sorteados de uma
// distribuição exponencial — normalizados, pesos exponenciais equivalem a
// fatiar o float por um simplex de Dirichlet(1,...,1): visivelmente
// concentrado (poucos grandes, muitos pequenos — o mesmo padrão de um float
// real, com poucos grandes detentores e muitos pequenos) em vez de
// uniforme.
//
// Determinística por (seed, assetID) — mesmo padrão de
// equity.NextPrice/fundamentals.NextGrowth (via tick.deterministicSeed):
// dois ativos distintos com a mesma seed base nunca recebem a mesma
// sequência de sorteio, mas a mesma chamada sempre reproduz exatamente o
// mesmo resultado (auditabilidade, RNF08).
//
// A soma de MarketMaker + soma(Others) é sempre exatamente totalFloat —
// nunca sobra nem falta uma ação por arredondamento, porque a distribuição
// entre os "outros" usa o método dos maiores restos (a mesma técnica de
// rateio proporcional usada em apuração eleitoral), que garante soma exata
// por construção em vez de só "na prática".
func InitialAllocation(assetID string, totalFloat int64, marketMakerSharePct float64, otherBotCount int, seed int64) (Allocation, error) {
	if totalFloat <= 0 {
		return Allocation{}, fmt.Errorf("%w: totalFloat precisa ser positivo (%d)", ErrInvalidAllocation, totalFloat)
	}
	if marketMakerSharePct < MarketMakerShareMin || marketMakerSharePct > MarketMakerShareMax {
		return Allocation{}, fmt.Errorf("%w: marketMakerSharePct precisa estar entre %.2f e %.2f (%.4f)",
			ErrInvalidAllocation, MarketMakerShareMin, MarketMakerShareMax, marketMakerSharePct)
	}
	if otherBotCount <= 0 {
		return Allocation{}, fmt.Errorf("%w: otherBotCount precisa ser positivo (%d)", ErrInvalidAllocation, otherBotCount)
	}

	// minShares/maxShares são o intervalo inteiro que efetivamente respeita
	// MarketMakerShareMin/Max pra este totalFloat — arredondar
	// marketMakerSharePct*totalFloat sem checar contra esse intervalo pode
	// estourar a faixa quando totalFloat é pequeno (ex: totalFloat=1,
	// marketMakerSharePct=0.50 arredonda pra 1 = 100%, não 40-60%). Quando
	// nenhum inteiro cabe no intervalo (totalFloat pequeno demais pra
	// sequer uma ação respeitar a faixa), a garantia do critério de aceite
	// é impossível de cumprir — erro em vez de devolver uma alocação que
	// violaria a faixa.
	minShares := int64(math.Ceil(float64(totalFloat) * MarketMakerShareMin))
	maxShares := int64(math.Floor(float64(totalFloat) * MarketMakerShareMax))
	if minShares > maxShares {
		return Allocation{}, fmt.Errorf("%w: totalFloat (%d) é pequeno demais pra garantir a faixa do Market Maker (%.2f-%.2f) com uma quantidade inteira de ações",
			ErrInvalidAllocation, totalFloat, MarketMakerShareMin, MarketMakerShareMax)
	}

	marketMakerShares := int64(math.Round(float64(totalFloat) * marketMakerSharePct))
	if marketMakerShares < minShares {
		marketMakerShares = minShares
	} else if marketMakerShares > maxShares {
		marketMakerShares = maxShares
	}
	remaining := totalFloat - marketMakerShares

	rng := rand.New(rand.NewSource(deterministicSeed(seed, assetID)))
	weights := make([]float64, otherBotCount)
	totalWeight := 0.0
	for i := range weights {
		weights[i] = rng.ExpFloat64()
		totalWeight += weights[i]
	}

	return Allocation{MarketMaker: marketMakerShares, Others: largestRemainderAllocation(weights, totalWeight, remaining)}, nil
}

// largestRemainderAllocation converte pesos (não precisam somar 1) numa
// distribuição inteira de exatamente `total` unidades — método dos maiores
// restos (largest remainder / Hamilton apportionment): cada peso vira uma
// cota fracionária (weight/totalWeight*total), o piso de cada cota já
// aproxima a distribuição do peso, e a diferença entre `total` e a soma dos
// pisos (sempre um inteiro não-negativo, na prática menor que len(weights))
// vai pros índices de maior resto fracionário, um a um. Escolhido em vez de,
// por exemplo, sempre jogar o resto no primeiro ou no maior peso, porque não
// introduz viés sistemático a favor de nenhum índice específico.
func largestRemainderAllocation(weights []float64, totalWeight float64, total int64) []int64 {
	n := len(weights)
	shares := make([]int64, n)
	fractions := make([]float64, n)
	assigned := int64(0)

	for i, w := range weights {
		exact := w / totalWeight * float64(total)
		floor := math.Floor(exact)
		shares[i] = int64(floor)
		fractions[i] = exact - floor
		assigned += shares[i]
	}

	remainder := int(total - assigned)
	// Salvaguarda contra erro de ponto flutuante na soma de `exact` (em
	// teoria soma exatamente `total`, na prática pode desviar por uma
	// fração de unidade de ponto flutuante) — sem isso, um remainder fora
	// de [0, n] faria o loop abaixo tentar incrementar um índice inexistente
	// ou deixar a soma final errada.
	if remainder < 0 {
		remainder = 0
	} else if remainder > n {
		remainder = n
	}

	indices := make([]int, n)
	for i := range indices {
		indices[i] = i
	}
	sort.SliceStable(indices, func(a, b int) bool {
		return fractions[indices[a]] > fractions[indices[b]]
	})
	for i := 0; i < remainder; i++ {
		shares[indices[i]]++
	}

	return shares
}

// deterministicSeed deriva uma seed determinística por ativo a partir da
// seed base — mesma técnica de tick.deterministicSeed (fnv64a do
// identificador somado à seed base), não reaproveitada diretamente porque
// tick é um pacote de domínio irmão, não uma dependência: cada pacote de
// domínio declara seu próprio ponto de consumo (.claude/arquitetura-engine-go.md).
func deterministicSeed(baseSeed int64, assetID string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(assetID))
	return baseSeed + int64(h.Sum64())
}
