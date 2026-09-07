import { describe, expect, it } from 'vitest'
import { trackNameFor, TRACKS } from '.'

describe('trackNameFor', () => {
    it.each(TRACKS)('resolve o nome da trilha $number pra "$name"', (track) => {
        expect(trackNameFor(track.number)).toBe(track.name)
    })

    it('devolve undefined pra um número de trilha fora do currículo', () => {
        expect(trackNameFor(99)).toBeUndefined()
    })
})
