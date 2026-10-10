package bot

import "math"

// Atenção por evento (tarefa Q.10, achado 014). Notícia atrai atenção: enquanto um
// evento macro afeta uma empresa, o volume dos ativos dela sobe e quem reage
// primeiro é o investidor informado (o Fundamentalista). O orçamento de turnos
// do tick é fixo (Q.8), então a atenção redistribui turnos para os ativos-alvo em
// vez de somar turnos. Valores ilustrativos, a validar na Q.4.
const (
	// AttentionBoost é o acréscimo máximo do multiplicador: um evento de efeito
	// cheio (AttentionFullEffectPct ou mais) leva o ativo a 1 + AttentionBoost
	// vezes a atenção normal.
	AttentionBoost = 4.0
	// AttentionFullEffectPct é o efeito de preço (escala percentual do evento,
	// faixa "severo" de 15% a 25%) a partir do qual a atenção é a máxima.
	AttentionFullEffectPct = 15.0
	// AttentionFundamentalistShare é a chance de um turno de ativo em atenção ser
	// servido por um Fundamentalista, o arquétipo que reage ao evento (proposta
	// 2.3.2: o efeito entra no preço só pela negociação desses bots).
	AttentionFundamentalistShare = 0.75
)

// AttentionMultiplier devolve o multiplicador de atenção de um ativo cuja
// empresa sofre hoje o efeito de preço combinado macroEffectPct (com sinal): 1
// sem evento, crescendo com a magnitude até 1 + AttentionBoost.
func AttentionMultiplier(macroEffectPct float64) float64 {
	magnitude := math.Min(math.Abs(macroEffectPct)/AttentionFullEffectPct, 1)
	return 1 + AttentionBoost*magnitude
}
