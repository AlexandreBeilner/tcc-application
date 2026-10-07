import { describe, expect, it } from 'vitest'
import { fgcCoverage } from '.'

describe('fgcCoverage', () => {
    it.each([
        [[100_000], false, 100_000, 0, false],
        [[400_000], false, 250_000, 150_000, false],
        [[250_000, 250_000, 250_000], false, 750_000, 0, false],
        [[250_000, 250_000, 250_000, 250_000, 250_000], false, 1_000_000, 250_000, true],
        [[250_000, 250_000], true, 250_000, 250_000, false],
        [[600_000], false, 250_000, 350_000, false],
    ])('%j (mesmo conglomerado: %s) cobre %f e deixa %f de fora', (amounts, same, covered, uncovered, capped) => {
        const result = fgcCoverage(amounts, same)
        expect(result.covered).toBe(covered)
        expect(result.uncovered).toBe(uncovered)
        expect(result.cappedByGlobal).toBe(capped)
    })
})
