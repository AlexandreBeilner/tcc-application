import { describe, expect, it } from 'vitest'
import { noise } from '.'

describe('noise', () => {
    it('é determinístico — a mesma seed sempre produz o mesmo valor', () => {
        expect(noise(42)).toBe(noise(42))
    })

    it('produz valores no intervalo [0, 1)', () => {
        for (let seed = 0; seed < 50; seed++) {
            const value = noise(seed)
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThan(1)
        }
    })
})
