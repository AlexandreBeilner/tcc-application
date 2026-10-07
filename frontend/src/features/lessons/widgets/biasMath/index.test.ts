import { describe, expect, it } from 'vitest'
import { BIAS_LABEL, BIAS_SCENARIOS, countPlanChoices } from '.'

describe('biasMath', () => {
    it('todo cenário tem 3 reações e exatamente uma segue o plano', () => {
        for (const scenario of BIAS_SCENARIOS) {
            expect(scenario.reactions).toHaveLength(3)
            expect(scenario.reactions.filter((r) => r.bias === null)).toHaveLength(1)
        }
    })

    it('ids de cenário são únicos e todo viés tem rótulo', () => {
        expect(new Set(BIAS_SCENARIOS.map((s) => s.id)).size).toBe(BIAS_SCENARIOS.length)
        for (const reaction of BIAS_SCENARIOS.flatMap((s) => s.reactions)) {
            if (reaction.bias) expect(BIAS_LABEL[reaction.bias]).toBeTruthy()
        }
    })

    it('conta só as escolhas que seguem o plano', () => {
        const planIndex = (id: string) => BIAS_SCENARIOS.find((s) => s.id === id)!.reactions.findIndex((r) => r.bias === null)
        const choices: Record<string, number> = {}
        for (const s of BIAS_SCENARIOS) choices[s.id] = planIndex(s.id)
        expect(countPlanChoices(choices)).toBe(BIAS_SCENARIOS.length)
        choices[BIAS_SCENARIOS[0].id] = (planIndex(BIAS_SCENARIOS[0].id) + 1) % 3
        expect(countPlanChoices(choices)).toBe(BIAS_SCENARIOS.length - 1)
        expect(countPlanChoices({})).toBe(0)
    })
})
