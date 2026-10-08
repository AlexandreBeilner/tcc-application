import { describe, expect, it } from 'vitest'
import { formatUpdatedAgo } from '.'

const now = new Date('2026-10-08T12:00:00Z')

describe('formatUpdatedAgo', () => {
    it.each([
        ['2026-10-08T11:30:00Z', 'Atualizado há pouco'],
        ['2026-10-08T12:00:00Z', 'Atualizado há pouco'],
        ['2026-10-08T09:00:00Z', 'Atualizado há 3 h'],
        ['2026-10-07T11:00:00Z', 'Atualizado há 1 dia'],
        ['2026-10-05T11:00:00Z', 'Atualizado há 3 dias'],
    ])('%s -> %s', (iso, expected) => {
        expect(formatUpdatedAgo(iso, now)).toBe(expected)
    })
})
