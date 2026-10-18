import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../../portfolio/format'
import { describeAchievementProgress } from '.'

describe('describeAchievementProgress', () => {
    it('net_worth formata os dois lados em moeda', () => {
        expect(describeAchievementProgress({ criteriaType: 'net_worth', criteriaValue: 15000, progress: 11200 })).toBe(
            `${formatCurrency(11200)} de ${formatCurrency(15000)}`,
        )
    })

    it('streak_days no plural', () => {
        expect(describeAchievementProgress({ criteriaType: 'streak_days', criteriaValue: 7, progress: 3 })).toBe('3 de 7 dias')
    })

    it('streak_days no singular quando o critério é 1', () => {
        expect(describeAchievementProgress({ criteriaType: 'streak_days', criteriaValue: 1, progress: 0 })).toBe('0 de 1 dia')
    })

    it('lessons_completed', () => {
        expect(describeAchievementProgress({ criteriaType: 'lessons_completed', criteriaValue: 33, progress: 10 })).toBe('10 de 33 lições')
    })

    it('trades_executed no singular quando o critério é 1', () => {
        expect(describeAchievementProgress({ criteriaType: 'trades_executed', criteriaValue: 1, progress: 0 })).toBe('0 de 1 operação')
    })

    it('micro_decisions_streak no plural', () => {
        expect(describeAchievementProgress({ criteriaType: 'micro_decisions_streak', criteriaValue: 5, progress: 3 })).toBe(
            '3 de 5 acertos seguidos',
        )
    })

    it('track_completed_no_errors no singular quando o critério é 1', () => {
        expect(describeAchievementProgress({ criteriaType: 'track_completed_no_errors', criteriaValue: 1, progress: 0 })).toBe(
            '0 de 1 trilha sem erro',
        )
    })

    it('lesson_reviewed no singular quando o critério é 1', () => {
        expect(describeAchievementProgress({ criteriaType: 'lesson_reviewed', criteriaValue: 1, progress: 0 })).toBe(
            '0 de 1 lição revisada',
        )
    })

    it('critérios do Diário', () => {
        expect(describeAchievementProgress({ criteriaType: 'daily_word_first_try', criteriaValue: 1, progress: 0 })).toBe(
            '0 de 1 palavra de primeira',
        )
        expect(describeAchievementProgress({ criteriaType: 'daily_perfect_days', criteriaValue: 10, progress: 4 })).toBe(
            '4 de 10 dias perfeitos',
        )
        expect(describeAchievementProgress({ criteriaType: 'daily_timeline_streak', criteriaValue: 7, progress: 3 })).toBe(
            '3 de 7 dias seguidos',
        )
    })
})
