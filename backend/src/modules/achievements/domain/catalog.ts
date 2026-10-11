import type { Achievement, AchievementCriteriaType } from './achievement'
import { InvalidAchievementError } from './errors'

export type CriteriaValueKind = 'integer' | 'currency'

// Lista fechada de regras de desbloqueio que o código sabe avaliar (`progressValueFor`):
// o painel (N.19) escolhe uma delas, nunca digita uma expressão. Regra nova exige código
// (um campo em `ProgressSnapshot` e um `case` em `progressValueFor`) e entra aqui.
export const ACHIEVEMENT_CRITERIA: Record<
  AchievementCriteriaType,
  { label: string; valueKind: CriteriaValueKind }
> = {
  net_worth: { label: 'Patrimônio (R$)', valueKind: 'currency' },
  streak_days: { label: 'Dias seguidos de streak', valueKind: 'integer' },
  lessons_completed: { label: 'Lições concluídas', valueKind: 'integer' },
  trades_executed: { label: 'Operações executadas', valueKind: 'integer' },
  micro_decisions_streak: { label: 'Acertos seguidos na Micro-decisão', valueKind: 'integer' },
  track_completed_no_errors: { label: 'Trilhas concluídas sem erro', valueKind: 'integer' },
  lesson_reviewed: { label: 'Lições revisadas', valueKind: 'integer' },
  assemblies_participated: { label: 'Assembleias em que votou', valueKind: 'integer' },
  referrals_qualified: { label: 'Amigos indicados que concluíram a 1ª lição', valueKind: 'integer' },
}

export const ACHIEVEMENT_CRITERIA_TYPES = Object.keys(
  ACHIEVEMENT_CRITERIA,
) as AchievementCriteriaType[]

export const MAX_ACHIEVEMENT_NAME_LENGTH = 100
export const MAX_ACHIEVEMENT_DESCRIPTION_LENGTH = 255
// A coluna é numeric(15,2): R$ 1 trilhão fica longe do estouro e longe de qualquer meta real.
export const MAX_CRITERIA_VALUE = 1_000_000_000_000

export interface AchievementDraft {
  name: string
  description: string | null
  criteriaType: AchievementCriteriaType
  criteriaValue: number
}

// Valida o que o painel manda: nome e descrição dentro das colunas, critério da lista
// fechada e meta positiva (inteira pros critérios de contagem, com centavos no patrimônio).
export function validateAchievementDraft(draft: AchievementDraft): AchievementDraft {
  const name = draft.name.trim()
  if (name.length === 0 || name.length > MAX_ACHIEVEMENT_NAME_LENGTH) {
    throw new InvalidAchievementError(
      `o nome precisa ter de 1 a ${MAX_ACHIEVEMENT_NAME_LENGTH} caracteres`,
    )
  }
  const description = draft.description?.trim() || null
  if (description !== null && description.length > MAX_ACHIEVEMENT_DESCRIPTION_LENGTH) {
    throw new InvalidAchievementError(
      `a descrição pode ter no máximo ${MAX_ACHIEVEMENT_DESCRIPTION_LENGTH} caracteres`,
    )
  }
  const criterion = ACHIEVEMENT_CRITERIA[draft.criteriaType]
  if (!criterion) {
    throw new InvalidAchievementError('critério de desbloqueio desconhecido')
  }
  const value = draft.criteriaValue
  if (!Number.isFinite(value) || value <= 0 || value > MAX_CRITERIA_VALUE) {
    throw new InvalidAchievementError(
      `a meta precisa ser positiva e de no máximo ${MAX_CRITERIA_VALUE}`,
    )
  }
  if (criterion.valueKind === 'integer' && !Number.isInteger(value)) {
    throw new InvalidAchievementError(`a meta de "${criterion.label}" precisa ser um inteiro`)
  }
  // Reais: no máximo duas casas decimais, como a coluna numeric(15,2).
  const cents = Math.round(value * 100) / 100
  if (criterion.valueKind === 'currency' && Math.abs(cents - value) > 1e-9) {
    throw new InvalidAchievementError('a meta em reais aceita no máximo duas casas decimais')
  }
  return {
    name,
    description,
    criteriaType: draft.criteriaType,
    criteriaValue: criterion.valueKind === 'currency' ? cents : value,
  }
}

// Nome único sem diferenciar caixa nem acento de borda: duas conquistas "iguais" na lista
// do jogador seriam um erro de cadastro, não uma escolha.
export function isNameTaken(
  name: string,
  catalog: Pick<Achievement, 'id' | 'name'>[],
  ignoreId?: string,
): boolean {
  const wanted = name.trim().toLocaleLowerCase('pt-BR')
  return catalog.some(
    (achievement) =>
      achievement.id !== ignoreId && achievement.name.trim().toLocaleLowerCase('pt-BR') === wanted,
  )
}
