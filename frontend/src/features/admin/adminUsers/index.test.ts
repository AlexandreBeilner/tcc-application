import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { ReauthCancelledError } from '../AdminReauth'
import { describeProvider, describeUserActionError, isAnonymized } from '.'

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
})
