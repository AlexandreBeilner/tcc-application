import { describe, expect, it } from 'vitest'
import { pollSummary } from '.'

describe('pollSummary', () => {
    it.each([
        [{ pollId: 'e', vote: 0 }, 'Você está entre os primeiros a responder.'],
        [{ pollId: 'e', vote: 1, results: { total: 20, percentages: [10, 90] } }, '90% responderam como você.'],
        [{ pollId: 'e', vote: 0, results: { total: 20, percentages: [100, 0] } }, 'Todo mundo respondeu como você.'],
    ])('%j', (state, expected) => {
        expect(pollSummary(state)).toBe(expected)
    })
})
