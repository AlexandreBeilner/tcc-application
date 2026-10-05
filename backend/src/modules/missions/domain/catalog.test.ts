import { describe, expect, it } from 'vitest'
import {
  MAX_MISSION_DESCRIPTION_LENGTH,
  MAX_MISSION_TITLE_LENGTH,
  MAX_MISSION_XP_REWARD,
  missionVerification,
  validateMissionPatch,
} from './catalog'
import { InvalidMissionError } from './errors'
import { MICRO_DECISION_STREAK_MISSION_KEY, REVIEW_OLD_LESSON_MISSION_KEY } from './mission'

describe('missionVerification', () => {
  it.each([
    [{ key: 'lesson_complete', requiresLessonCompletion: true }, 'lesson_completion'],
    [{ key: REVIEW_OLD_LESSON_MISSION_KEY, requiresLessonCompletion: false }, 'server_check'],
    [{ key: MICRO_DECISION_STREAK_MISSION_KEY, requiresLessonCompletion: false }, 'server_check'],
    [{ key: 'feed_read', requiresLessonCompletion: false }, 'client_reported'],
  ])('classifica %j como %s', (mission, expected) => {
    expect(missionVerification(mission)).toBe(expected)
  })
})

describe('validateMissionPatch', () => {
  it('normaliza e devolve só os campos que vieram', () => {
    expect(validateMissionPatch({ title: '  Novo título  ', xpReward: 40 })).toEqual({
      title: 'Novo título',
      xpReward: 40,
    })
    expect(validateMissionPatch({ description: '   ' })).toEqual({ description: null })
    expect(validateMissionPatch({ isActive: false })).toEqual({ isActive: false })
    expect(validateMissionPatch({})).toEqual({})
  })

  it.each([
    ['título vazio', { title: '  ' }],
    ['título longo demais', { title: 'x'.repeat(MAX_MISSION_TITLE_LENGTH + 1) }],
    ['descrição longa demais', { description: 'x'.repeat(MAX_MISSION_DESCRIPTION_LENGTH + 1) }],
    ['XP zero', { xpReward: 0 }],
    ['XP negativo', { xpReward: -10 }],
    ['XP fracionado', { xpReward: 10.5 }],
    ['XP NaN', { xpReward: Number.NaN }],
    ['XP infinito', { xpReward: Number.POSITIVE_INFINITY }],
    ['XP acima do teto', { xpReward: MAX_MISSION_XP_REWARD + 1 }],
  ])('recusa %s', (_name, patch) => {
    expect(() => validateMissionPatch(patch)).toThrow(InvalidMissionError)
  })
})
