import { describe, expect, it } from 'vitest'
import { ApiError } from '../../services/client'
import { apiErrorCode, formatApiError } from '.'

describe('formatApiError', () => {
    it('devolve a mensagem em português de um erro 4xx da API', () => {
        expect(formatApiError(new ApiError(422, 'Saldo insuficiente para essa operação.'), 'x')).toBe(
            'Saldo insuficiente para essa operação.',
        )
    })

    it('usa o fallback para erro de servidor, erro de rede e erro desconhecido', () => {
        expect(formatApiError(new ApiError(500, 'erro interno'), 'fallback')).toBe('fallback')
        expect(formatApiError(new TypeError('Failed to fetch'), 'fallback')).toBe('fallback')
        expect(formatApiError('string solta', 'fallback')).toBe('fallback')
    })

    it('nunca mostra texto com cara de interno (snake_case, código técnico)', () => {
        expect(formatApiError(new ApiError(400, 'soma excede outstanding_shares do ativo'), 'fallback')).toBe('fallback')
        expect(formatApiError(new ApiError(401, 'reauth_required'), 'fallback')).toBe('fallback')
        expect(formatApiError(new ApiError(400, ''), 'fallback')).toBe('fallback')
    })
})

describe('apiErrorCode', () => {
    it('lê o code estável do corpo do erro', () => {
        expect(apiErrorCode(new ApiError(422, 'm', { code: 'insufficient_balance' }))).toBe('insufficient_balance')
    })

    it('devolve null sem code ou sem ApiError', () => {
        expect(apiErrorCode(new ApiError(422, 'm', { error: 'm' }))).toBeNull()
        expect(apiErrorCode(new Error('m'))).toBeNull()
    })
})
