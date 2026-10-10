import { describe, expect, it } from 'vitest'
import type { AdminLesson } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { describeLessonError, formatDuration, formatRate, groupLessonsByTrack, worstAbandonStep } from '.'

describe('formatRate', () => {
    it('formata em percentual inteiro e trata ausência de base', () => {
        expect(formatRate(0.625)).toBe('63%')
        expect(formatRate(0)).toBe('0%')
        expect(formatRate(null)).toBe('sem dados')
    })
})

describe('formatDuration', () => {
    it.each([
        [null, 'sem dados'],
        [12, '12 s'],
        [180, '3 min'],
        [3600, '1 h'],
        [4800, '1 h 20 min'],
    ])('%s -> %s', (seconds, expected) => {
        expect(formatDuration(seconds)).toBe(expected)
    })
})

describe('worstAbandonStep', () => {
    it('devolve o passo com mais abandonos e, em empate, o mais cedo', () => {
        expect(worstAbandonStep({ abandoned_by_step: [1, 4, 4, 0] })).toEqual({ label: 'Micro-decisão', count: 4 })
    })

    it('devolve null quando ninguém abandonou', () => {
        expect(worstAbandonStep({ abandoned_by_step: [0, 0, 0, 0] })).toBeNull()
    })
})

describe('groupLessonsByTrack', () => {
    it('agrupa por trilha na ordem da trilha', () => {
        const lesson = (code: string, track: number, order: number) =>
            ({ code, track_number: track, track_name: `T${track}`, sort_order: order }) as AdminLesson

        const groups = groupLessonsByTrack([lesson('1.1', 1, 3), lesson('0.2', 0, 2), lesson('0.1', 0, 1)])

        expect(groups.map((g) => [g.trackNumber, g.lessons.map((l) => l.code)])).toEqual([
            [0, ['0.1', '0.2']],
            [1, ['1.1']],
        ])
    })
})

describe('describeLessonError', () => {
    it('repassa a mensagem do backend em 404, 409 e 422 e generaliza o resto', () => {
        expect(describeLessonError(new ApiError(409, 'a lição já está publicada'))).toBe('a lição já está publicada')
        expect(describeLessonError(new ApiError(400, 'x'))).toContain('Dados inválidos')
        expect(describeLessonError(new Error('rede'))).toContain('Não foi possível')
    })
})
