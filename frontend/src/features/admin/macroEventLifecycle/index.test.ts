import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { buildMacroEventFilters, describeCancelError, describeTriggerError, EMPTY_FILTER_DRAFT, phaseOf } from '.'

describe('phaseOf', () => {
    it('pendente ainda sem efeito é agendado; os demais seguem o status do motor', () => {
        expect(phaseOf({ status: 'pendente', scheduled: true })).toBe('agendado')
        expect(phaseOf({ status: 'pendente', scheduled: false })).toBe('pendente')
        expect(phaseOf({ status: 'pendente' })).toBe('pendente')
        expect(phaseOf({ status: 'aplicado', scheduled: false })).toBe('aplicado')
        expect(phaseOf({ status: 'cancelado', scheduled: true })).toBe('cancelado')
    })
})

describe('buildMacroEventFilters', () => {
    it('sem nada preenchido não filtra', () => {
        expect(buildMacroEventFilters(EMPTY_FILTER_DRAFT)).toEqual({ filters: {} })
    })

    it('converte status, alvo e período', () => {
        const { filters, error } = buildMacroEventFilters({
            status: 'cancelado',
            targetKind: 'sector',
            targetValue: 'Mineração',
            fromDay: '10',
            toDay: ' 50 ',
        })
        expect(error).toBeUndefined()
        expect(filters).toEqual({ status: 'cancelado', sector: 'Mineração', from_day: 10, to_day: 50 })
    })

    it('tipo de alvo sem valor escolhido não filtra por alvo', () => {
        expect(buildMacroEventFilters({ ...EMPTY_FILTER_DRAFT, targetKind: 'asset_id' }).filters).toEqual({})
    })

    it('período inválido devolve o motivo', () => {
        expect(buildMacroEventFilters({ ...EMPTY_FILTER_DRAFT, fromDay: 'x' }).error).toMatch(/inteiros/)
        expect(buildMacroEventFilters({ ...EMPTY_FILTER_DRAFT, fromDay: '9', toDay: '3' }).error).toMatch(/maior que o final/)
    })
})

describe('mensagens de erro', () => {
    it('cancelar: o 409 mostra o motivo do motor', () => {
        expect(describeCancelError(new ApiError(409, 'o evento já começou a produzir efeito e não pode mais ser cancelado'))).toBe(
            'Não foi possível cancelar: o evento já começou a produzir efeito e não pode mais ser cancelado.',
        )
        expect(describeCancelError(new ApiError(404, 'x'))).toBe('Esse evento não existe mais.')
        expect(describeCancelError(new Error('rede'))).toMatch(/Confira o histórico/)
    })

    it('disparar: usa a mensagem do motor ou a genérica', () => {
        expect(describeTriggerError(new ApiError(400, 'o dia de aplicação precisa ser posterior'))).toBe(
            'o dia de aplicação precisa ser posterior',
        )
        expect(describeTriggerError(new Error('rede'))).toMatch(/Tente novamente/)
        expect(describeTriggerError(null)).toBeNull()
    })
})
