package tick

import (
	"math/rand"
	"sort"
)

// IntradayRound é um ponto de negociação de bot sorteado dentro do
// "expediente" simulado de um dia (Fase D.1, cadência intradiária, proposta
// motor-mercado-realista 2.4) — SequenceIndex é a posição da rodada dentro
// do dia (0-based, ordem cronológica); TimeOfDay é a posição relativa dela
// dentro do expediente, em [0, 1) (perto de 0 = abertura, perto de 1 =
// fechamento) — não um horário de relógio real (o motor não modela hora do
// dia, spec 3.2.1 só define dia simulado), só a ordem relativa em que as
// rodadas caem dentro do dia. Consumido pela Fase D.2 (execução de rodadas
// de negociação, ainda não implementada) pra decidir quando cada rodada de
// coleta de decisão de bot + matching acontece dentro do mesmo tick.
type IntradayRound struct {
	SequenceIndex int
	TimeOfDay     float64
}

// intradayRoundCountWeights calibra o sorteio de quantas rodadas de
// negociação de bot um dia simulado terá (proposta 2.4: "de 1 a 4 rodadas
// ... enviesado pra 2-3 como dia normal, com 1 e 4 mais raros" — a
// distribuição exata fica pra calibração fina, spec seção 8). Índice i
// corresponde à quantidade i+1 rodadas; pesos ilustrativos somando 15%
// (1 rodada) / 35% (2) / 35% (3) / 15% (4) — mesmo tratamento de "valor
// ilustrativo, sujeito a calibração futura" já dado a outros coeficientes
// do motor (ex: bot.NoisePriceBandPct, bot.ChartistTrendThresholdPct).
var intradayRoundCountWeights = [4]int{3, 7, 7, 3}

// intradayRoundCount sorteia quantas rodadas o dia terá (1-4), enviesado
// conforme intradayRoundCountWeights.
func intradayRoundCount(rng *rand.Rand) int {
	total := 0
	for _, weight := range intradayRoundCountWeights {
		total += weight
	}

	draw := rng.Intn(total)
	cumulative := 0
	for i, weight := range intradayRoundCountWeights {
		cumulative += weight
		if draw < cumulative {
			return i + 1
		}
	}
	// Inalcançável — a soma de intradayRoundCountWeights sempre cobre todo
	// o intervalo [0, total) sorteado por rng.Intn acima.
	return len(intradayRoundCountWeights)
}

// IntradayRounds sorteia, determinístico por (seed, dayIndex), a cadência
// intradiária do dia simulado dayIndex (0-based, mesma convenção de
// selic.NextCalendarRate/fundamentals.IsReportDay): quantas rodadas de
// negociação de bot o dia terá (intradayRoundCount, 1-4) e em que ponto do
// expediente simulado cada uma cai — N sorteios independentes em [0,1),
// ordenados cronologicamente, nunca um cronograma de slots igualmente
// espaçados (proposta 2.4: o autor pediu explicitamente horário variável e
// não previsível, pra impedir que a cadência vire algo gameável — um
// cronograma fixo tipo "sempre às 10h/12h/14h/16h simuladas" reabriria
// exatamente esse problema). Processo independente do resto do tick
// (deterministicSeed com um id fixo — mesma técnica de isolamento de
// processo por entidade já usada pra ativo/empresa em equity.NextPrice/
// fundamentalsConfig): dois dias diferentes com a mesma seed base nunca
// sorteiam a mesma sequência, e esta sortição nunca compartilha o stream de
// números aleatórios usado por outra parte do tick (Selic, GBM,
// fundamentos) no mesmo dia. Não muda nada mais no ritmo diário do tick —
// Selic, calendário de relatório e proventos continuam avançando 1x por
// dia; isto só produz um novo insumo que a Fase D.2 vai consumir.
func IntradayRounds(seed int64, dayIndex int) []IntradayRound {
	rng := rand.New(rand.NewSource(deterministicSeed(seed, "intraday-rounds") + int64(dayIndex)))

	count := intradayRoundCount(rng)
	times := make([]float64, count)
	for i := range times {
		times[i] = rng.Float64()
	}
	sort.Float64s(times)

	rounds := make([]IntradayRound, count)
	for i, t := range times {
		rounds[i] = IntradayRound{SequenceIndex: i, TimeOfDay: t}
	}
	return rounds
}
