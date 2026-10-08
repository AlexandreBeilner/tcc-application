import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import type { IntegrityRun } from '../../../services/admin'
import { describeIntegrityError, formatDivergenceValue, INTEGRITY_KINDS, isRunning } from '.'

describe('integrity', () => {
    it('lista as 7 categorias que o motor confere, cada uma com rótulo e dica', () => {
        expect(INTEGRITY_KINDS.map((k) => k.kind)).toEqual([
            'balance_mismatch',
            'position_mismatch',
            'negative_balance',
            'negative_position',
            'float_mismatch',
            'resting_order_unfunded',
            'unknown_event_type',
        ])
        for (const k of INTEGRITY_KINDS) {
            expect(k.label.length).toBeGreaterThan(0)
            expect(k.hint.length).toBeGreaterThan(0)
        }
    })

    it('isRunning só é verdadeiro com a verificação em andamento', () => {
        const run = (status: IntegrityRun['status']) => ({ status }) as IntegrityRun
        expect(isRunning(run('running'))).toBe(true)
        expect(isRunning(run('done'))).toBe(false)
        expect(isRunning(run('failed'))).toBe(false)
        expect(isRunning(null)).toBe(false)
        expect(isRunning(undefined)).toBe(false)
    })

    it('formata como dinheiro só as categorias monetárias, deixa quantidade como veio', () => {
        expect(formatDivergenceValue('balance_mismatch', '9900.00')).toMatch(/9\.900,00/)
        expect(formatDivergenceValue('resting_order_unfunded', '20000.00')).toMatch(/20\.000,00/)
        expect(formatDivergenceValue('position_mismatch', '10')).toBe('10')
        expect(formatDivergenceValue('float_mismatch', '500000007')).toBe('500000007')
        expect(formatDivergenceValue('balance_mismatch', '0.00 ou mais')).toBe('0.00 ou mais')
    })

    it('mensagem própria para 409 e genérica para o resto', () => {
        expect(describeIntegrityError(new ApiError(409, 'x'))).toMatch(/em andamento/)
        expect(describeIntegrityError(new Error('x'))).toMatch(/motor/)
    })
})
