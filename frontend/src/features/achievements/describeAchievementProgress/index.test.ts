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
})
