// Pergunta do dia: uma alternativa certa entre as oferecidas.
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
