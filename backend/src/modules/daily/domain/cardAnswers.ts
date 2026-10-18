// Neste dia na história: uma alternativa certa entre as oferecidas.
export type ChoiceEvaluation =
  { ok: true; correct: boolean } | { ok: false; reason: 'invalid_choice' }

export function evaluateChoice(
  chosenIndex: number,
  correctIndex: number,
  optionCount: number,
): ChoiceEvaluation {
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= optionCount) {
    return { ok: false, reason: 'invalid_choice' }
  }
  return { ok: true, correct: chosenIndex === correctIndex }
}

export interface TimelineEvent {
  id: string
  year: number
}

export type OrderEvaluation =
  { ok: true; correct: boolean; positionHits: boolean[] } | { ok: false; reason: 'invalid_order' }

// Linha do tempo: a ordem certa é a cronológica. `submittedIds` precisa ser
// uma permutação exata dos eventos do jogo; qualquer outra coisa é inválida
// (não gasta a tentativa do cartão).
export function evaluateTimelineOrder(
  submittedIds: readonly string[],
  events: readonly TimelineEvent[],
): OrderEvaluation {
  const expected = [...events].sort((x, y) => x.year - y.year).map((e) => e.id)
  const isPermutation =
    submittedIds.length === expected.length &&
    new Set(submittedIds).size === expected.length &&
    submittedIds.every((id) => expected.includes(id))
  if (!isPermutation) return { ok: false, reason: 'invalid_order' }

  const positionHits = submittedIds.map((id, i) => id === expected[i])
  return { ok: true, correct: positionHits.every(Boolean), positionHits }
}
