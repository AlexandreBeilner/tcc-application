import { describe, expect, it } from 'vitest'
import { computePasswordStrength } from '.'

describe('computePasswordStrength', () => {
    it.each([
        ['', null],
        ['abc', 'weak'],
        ['abcdefgh', 'weak'],
        ['abcdefgh1', 'medium'],
        ['Abcdefgh1', 'medium'],
        ['Abcdefghijkl1', 'strong'],
        ['Abcdefgh1!', 'strong'],
    ] as const)('%s -> %s', (password, expected) => {
        expect(computePasswordStrength(password)).toBe(expected)
    })
})
