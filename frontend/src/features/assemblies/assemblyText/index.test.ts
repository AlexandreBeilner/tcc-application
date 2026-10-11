import { describe, expect, it } from 'vitest'
import type { AssemblyDetail } from '../../../services/assemblies'
import { closesLabel, describeEffect, isCreditShortage, outcomeBadge, percentLabel, resultHeadline } from '.'

const detail = (over: Partial<AssemblyDetail>): AssemblyDetail => ({
    assembly: {} as AssemblyDetail['assembly'],
    options: [{ id: 'o1', key: 'a', label: 'Reinvestir', gain: 'g', loss: 'l', effect: null, position: 0 }],
    scoreboard: { voters: 0, options: [] },
    result: null,
    minVoters: 3,
    ...over,
})

describe('assemblyText', () => {
    it('descreve o efeito sem veredito nem valor, e omite quando não há', () => {
        expect(describeEffect({ metric: 'growth', direction: 1, intensity: 0.8 })).toBe(
            'Empurra para cima o ritmo de crescimento da empresa, com força forte.',
        )
        expect(describeEffect({ metric: 'quality', direction: -1, intensity: 0.3 })).toBe(
            'Empurra para baixo a qualidade da operação (margem e alavancagem), com força leve.',
        )
        expect(describeEffect({ metric: 'growth', direction: 1, intensity: 0.5 })).toContain('moderada')
        expect(describeEffect(null)).toBeNull()
    })

    it('prazo em dias, "menos de 1 dia" e encerrada', () => {
        const now = new Date('2026-10-10T12:00:00Z')
        expect(closesLabel('2026-10-13T12:00:00Z', now)).toBe('Fecha em 3 dias')
        expect(closesLabel('2026-10-10T20:00:00Z', now)).toBe('Fecha em menos de 1 dia')
        expect(closesLabel('2026-10-10T11:00:00Z', now)).toBe('Votação encerrada')
    })

    it('resultado: aprovada com a opção, sem quórum e empate (nada muda)', () => {
        const base = { voterCount: 3, decidedAt: 'x' }
        expect(resultHeadline(detail({ result: { ...base, outcome: 'approved', reason: 'decided', winningOptionId: 'o1' } }))).toBe(
            'Aprovada: Reinvestir',
        )
        expect(resultHeadline(detail({ result: { ...base, outcome: 'not_approved', reason: 'quorum', winningOptionId: null } }))).toContain(
            'mínimo é 3',
        )
        expect(resultHeadline(detail({ result: { ...base, outcome: 'not_approved', reason: 'tie', winningOptionId: null } }))).toContain(
            'Empate',
        )
        expect(resultHeadline(detail({}))).toBeNull()
    })

    it('selo da lista e utilidades', () => {
        expect(outcomeBadge({ status: 'open', outcome: null, outcomeReason: null })).toBe('Votação aberta')
        expect(outcomeBadge({ status: 'closed', outcome: 'approved', outcomeReason: 'decided' })).toBe('Aprovada')
        expect(outcomeBadge({ status: 'closed', outcome: 'not_approved', outcomeReason: 'quorum' })).toBe('Sem votantes suficientes')
        expect(isCreditShortage('no_credit')).toBe(true)
        expect(isCreditShortage('not_shareholder')).toBe(false)
        expect(percentLabel(33.3)).toBe('33,3%')
    })
})
