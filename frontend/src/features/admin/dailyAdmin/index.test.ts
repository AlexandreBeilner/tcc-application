import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { categoryLabel, describeDailyError, formatGameDate, formatNumbers, isConfirmationRequired, tallyShare } from '.'

describe('dailyAdmin', () => {
    it('formata a data do jogo sem passar por fuso', () => {
        expect(formatGameDate('2026-11-03')).toBe('03/11/2026')
    })

    it('rotula categoria conhecida e devolve a chave da desconhecida', () => {
        expect(categoryLabel('juros-e-inflacao')).toBe('Juros e inflação')
        expect(categoryLabel('nova')).toBe('nova')
    })

    it('calcula a parcela Brasil/fora e lida com cobertura vazia', () => {
        expect(tallyShare({ total: 4, brasil: 3, fora: 1, by_category: {} }, 'brasil')).toBe('75%')
        expect(tallyShare({ total: 0, brasil: 0, fora: 0, by_category: {} }, 'fora')).toBe('0%')
    })

    it('lista os números dos jogos', () => {
        expect(formatNumbers([1, 4])).toBe('#1, #4')
    })

    it('descreve 409 e 422 com o motivo da API e os problemas', () => {
        const conflict = new ApiError(409, 'o Diário já está no ar', { error: 'x', code: 'already_started' })
        expect(describeDailyError(conflict)).toEqual({ message: 'o Diário já está no ar', code: 'already_started', problems: [] })

        const invalid = new ApiError(422, 'a; b', { error: 'a; b', code: 'invalid_daily_content', problems: ['a', 'b'] })
        expect(describeDailyError(invalid).problems).toEqual(['a', 'b'])
    })

    it('400 e erro desconhecido viram mensagem genérica', () => {
        expect(describeDailyError(new ApiError(400, 'x')).message).toContain('Dados inválidos')
        expect(describeDailyError(new Error('boom')).message).toContain('Não foi possível')
    })

    it('reconhece o 409 que pede confirmação', () => {
        expect(isConfirmationRequired(new ApiError(409, 'x', { code: 'confirmation_required' }))).toBe(true)
        expect(isConfirmationRequired(new ApiError(409, 'x', { code: 'duplicate' }))).toBe(false)
        expect(isConfirmationRequired(new Error('x'))).toBe(false)
    })
})
