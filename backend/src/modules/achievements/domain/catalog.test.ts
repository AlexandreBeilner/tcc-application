import { describe, expect, it } from 'vitest'
import { progressValueFor, type AchievementCriteriaType } from './achievement'
import {
  ACHIEVEMENT_CRITERIA_TYPES,
  MAX_ACHIEVEMENT_DESCRIPTION_LENGTH,
  MAX_ACHIEVEMENT_NAME_LENGTH,
  MAX_CRITERIA_VALUE,
  isNameTaken,
  validateAchievementDraft,
  type AchievementDraft,
} from './catalog'
import { InvalidAchievementError } from './errors'

const valid: AchievementDraft = {
  name: 'Primeira Semana',
  description: 'Sete dias seguidos.',
  criteriaType: 'streak_days',
  criteriaValue: 7,
}

describe('ACHIEVEMENT_CRITERIA', () => {
  it('cobre exatamente as regras que o código sabe avaliar (lista fechada)', () => {
    const snapshot = {
      netWorth: 1,
      streakDays: 2,
      lessonsCompleted: 3,
      tradesExecuted: 4,
      microDecisionsStreak: 5,
      tracksCompletedNoErrors: 6,
      lessonsReviewed: 7,
      assembliesParticipated: 8,
    }
    const expected: AchievementCriteriaType[] = [
      'net_worth',
      'streak_days',
      'lessons_completed',
      'trades_executed',
      'micro_decisions_streak',
      'track_completed_no_errors',
      'lesson_reviewed',
      'assemblies_participated',
    ]

    expect([...ACHIEVEMENT_CRITERIA_TYPES].sort()).toEqual([...expected].sort())
    for (const type of ACHIEVEMENT_CRITERIA_TYPES) {
      // Toda regra da lista tem avaliador (`progressValueFor` devolve um número do snapshot).
      expect(typeof progressValueFor(type, snapshot)).toBe('number')
    }
  })
})

describe('validateAchievementDraft', () => {
  it('aceita um rascunho válido e normaliza espaços e descrição vazia', () => {
    expect(validateAchievementDraft({ ...valid, name: '  Fiel  ', description: '   ' })).toEqual({
      name: 'Fiel',
      description: null,
      criteriaType: 'streak_days',
      criteriaValue: 7,
    })
  })

  it.each([
    ['nome vazio', { name: '   ' }],
    ['nome longo demais', { name: 'x'.repeat(MAX_ACHIEVEMENT_NAME_LENGTH + 1) }],
    ['descrição longa demais', { description: 'x'.repeat(MAX_ACHIEVEMENT_DESCRIPTION_LENGTH + 1) }],
    [
      'critério fora da lista fechada',
      { criteriaType: 'qualquer_coisa' as AchievementCriteriaType },
    ],
    ['meta zero', { criteriaValue: 0 }],
    ['meta negativa', { criteriaValue: -3 }],
    ['meta NaN', { criteriaValue: Number.NaN }],
    ['meta infinita', { criteriaValue: Number.POSITIVE_INFINITY }],
    ['meta acima do teto', { criteriaValue: MAX_CRITERIA_VALUE + 1 }],
    ['meta fracionada num critério de contagem', { criteriaValue: 7.5 }],
  ])('recusa %s', (_name, override) => {
    expect(() => validateAchievementDraft({ ...valid, ...override })).toThrow(
      InvalidAchievementError,
    )
  })

  it('patrimônio aceita centavos, mas no máximo duas casas', () => {
    const net = { ...valid, criteriaType: 'net_worth' as const }

    expect(validateAchievementDraft({ ...net, criteriaValue: 12000.5 }).criteriaValue).toBe(12000.5)
    expect(validateAchievementDraft({ ...net, criteriaValue: 0.01 }).criteriaValue).toBe(0.01)
    expect(() => validateAchievementDraft({ ...net, criteriaValue: 100.001 })).toThrow(
      InvalidAchievementError,
    )
  })
})

describe('isNameTaken', () => {
  const catalog = [
    { id: 'a1', name: 'Primeira Semana' },
    { id: 'a2', name: 'Fiel' },
  ]

  it('compara sem diferenciar caixa nem espaços de borda', () => {
    expect(isNameTaken('  primeira semana ', catalog)).toBe(true)
    expect(isNameTaken('Outra', catalog)).toBe(false)
  })

  it('ignora a própria conquista ao editar', () => {
    expect(isNameTaken('Fiel', catalog, 'a2')).toBe(false)
    expect(isNameTaken('Fiel', catalog, 'a1')).toBe(true)
  })
})
