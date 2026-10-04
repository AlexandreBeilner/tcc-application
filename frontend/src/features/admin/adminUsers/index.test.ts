import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { ReauthCancelledError } from '../AdminReauth'
import { describeCorrectionError, describeProvider, describeUserActionError, isAnonymized, parseCreditAmount, parseWholeNumber } from '.'

describe('adminUsers', () => {
    it('descreve provedores conhecidos e repassa os desconhecidos', () => {
        expect(describeProvider('password')).toBe('E-mail e senha')
        expect(describeProvider('google')).toBe('Google')
        expect(describeProvider('github')).toBe('github')
    })

    it('reconhece conta anonimizada pelo username sintético', () => {
        expect(isAnonymized('usuario-removido-1a2b3c4d')).toBe(true)
        expect(isAnonymized('maria')).toBe(false)
    })

    it('traduz cada erro das ações em texto pro admin', () => {
        expect(describeUserActionError(new ReauthCancelledError())).toMatch(/senha não confirmada/)
        expect(describeUserActionError(new ApiError(404, 'x'))).toBe('Usuário não encontrado.')
        expect(describeUserActionError(new ApiError(409, 'a conta já está suspensa'))).toBe('A conta já está suspensa.')
        expect(describeUserActionError(new ApiError(409, 'a conta não está suspensa'))).toBe('A conta não está suspensa.')
        expect(describeUserActionError(new ApiError(422, 'x', { code: 'admin_account_protected' }))).toMatch(/administrador/)
        expect(describeUserActionError(new ApiError(422, 'x', { code: 'confirmation_mismatch' }))).toBe('O username digitado não confere.')
        expect(describeUserActionError(new ApiError(400, 'x'))).toMatch(/Dados inválidos/)
        expect(describeUserActionError(new Error('rede'))).toMatch(/Não foi possível concluir/)
    })

    it.each([
        ['1500', 1500],
        ['1500.5', 1500.5],
        ['1.500,50', 1500.5],
        ['1500,5', 1500.5],
        ['  250  ', 250],
        ['1.234.567,89', 1234567.89],
        ['9000000000000', 9_000_000_000_000],
    ])('interpreta o valor do crédito "%s" como %s', (raw, expected) => {
        expect(parseCreditAmount(raw)).toBe(expected)
    })

    it.each(['', '   ', '0', '0,00', '-5', 'abc', '1,2,3', '1e5', 'Infinity', 'NaN', '12,5x'])('recusa o valor do crédito "%s"', (raw) => {
        expect(parseCreditAmount(raw)).toBeNull()
    })

    it('interpreta inteiros com sinal e recusa o resto', () => {
        expect(parseWholeNumber('-50')).toBe(-50)
        expect(parseWholeNumber('+7')).toBe(7)
        expect(parseWholeNumber(' 0 ')).toBe(0)
        for (const raw of ['', '1.5', '1,5', 'dez', '1e3', '99999999999999999999']) {
            expect(parseWholeNumber(raw)).toBeNull()
        }
    })

    it('traduz os erros das correções, repassando a mensagem do backend em 404, 409 e 422', () => {
        expect(describeCorrectionError(new ReauthCancelledError())).toMatch(/senha não confirmada/)
        expect(describeCorrectionError(new ApiError(409, 'o usuário já tem essa conquista'))).toBe('o usuário já tem essa conquista')
        expect(describeCorrectionError(new ApiError(422, 'não dá pra tirar 500'))).toBe('não dá pra tirar 500')
        expect(describeCorrectionError(new ApiError(404, 'conquista não encontrada'))).toBe('conquista não encontrada')
        expect(describeCorrectionError(new ApiError(400, 'x'))).toMatch(/Dados inválidos/)
        expect(describeCorrectionError(new Error('rede'))).toMatch(/Não foi possível concluir/)
    })
})
