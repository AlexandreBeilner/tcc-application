import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { asProductLockedError } from '.'

describe('asProductLockedError', () => {
    it('null pra erro que não é ApiError', () => {
        expect(asProductLockedError(new Error('falha de rede'))).toBeNull()
    })

    it('null pra ApiError que não é 403', () => {
        const err = new ApiError(401, 'não autenticado')
        expect(asProductLockedError(err)).toBeNull()
    })

    it('null pra 403 sem o corpo de ProductLockedError (ex: outro tipo de bloqueio)', () => {
        const err = new ApiError(403, 'acesso negado', { error: 'acesso negado' })
        expect(asProductLockedError(err)).toBeNull()
    })

    it('extrai key/unlockingLesson do corpo de um 403 de ProductLockedError', () => {
        const err = new ApiError(403, 'produto travado', {
            error: 'produto travado',
            key: 'asset:acao',
            unlockingLesson: { code: '2.3', title: 'Nomenclatura de tickers' },
        })

        expect(asProductLockedError(err)).toEqual({
            error: 'produto travado',
            key: 'asset:acao',
            unlockingLesson: { code: '2.3', title: 'Nomenclatura de tickers' },
        })
    })

    it('unlockingLesson null quando nenhuma lição seedada ainda cobre a chave', () => {
        const err = new ApiError(403, 'produto travado', { error: 'produto travado', key: 'asset:cri', unlockingLesson: null })

        expect(asProductLockedError(err)).toEqual({ error: 'produto travado', key: 'asset:cri', unlockingLesson: null })
    })
})
