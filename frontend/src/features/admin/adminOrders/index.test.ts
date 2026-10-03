import { describe, expect, it } from 'vitest'
import type { AdminOrder } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { describeCancelError, describeCancelReason, describeOwner, isCancellable, isUuid } from '.'

const base: AdminOrder = {
    order_id: 'o1',
    asset_id: 'a1',
    ticker: 'ACME3',
    user_id: '1d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a33',
    is_bot: false,
    bot_archetype: null,
    side: 'buy',
    type: 'limit',
    quantity: 100,
    filled_quantity: 0,
    price: 10,
    status: 'pending',
    cancel_reason: null,
    simulated_day: 3,
    created_at: '2026-10-03T12:00:00Z',
}

describe('adminOrders', () => {
    it('só ordem aberta ou parcial é cancelável', () => {
        expect(isCancellable(base)).toBe(true)
        expect(isCancellable({ ...base, status: 'partially_filled' })).toBe(true)
        expect(isCancellable({ ...base, status: 'filled' })).toBe(false)
        expect(isCancellable({ ...base, status: 'cancelled' })).toBe(false)
    })

    it('descreve o dono: bot com arquétipo ou usuário com id curto', () => {
        expect(describeOwner({ ...base, is_bot: true, bot_archetype: 'market_maker' })).toBe('Bot (Market Maker)')
        expect(describeOwner({ ...base, is_bot: true })).toBe('Bot')
        expect(describeOwner(base)).toBe('Usuário 1d0b8f1e')
    })

    it('traduz o motivo de cancelamento e mantém o desconhecido', () => {
        expect(describeCancelReason(null)).toBeNull()
        expect(describeCancelReason('admin')).toBe('por intervenção do admin')
        expect(describeCancelReason('novo_motivo')).toBe('novo_motivo')
    })

    it('reconhece UUID', () => {
        expect(isUuid(base.user_id)).toBe(true)
        expect(isUuid('abc')).toBe(false)
    })

    it('descreve os erros conhecidos do cancelamento', () => {
        expect(describeCancelError(new ApiError(404, 'x'))).toBe('Essa ordem não existe mais.')
        expect(describeCancelError(new ApiError(409, 'x'))).toContain('já foi executada ou cancelada')
        const tooLarge = new ApiError(422, 'x', { code: 'batch_too_large', matched: 501, max: 500 })
        expect(describeCancelError(tooLarge)).toContain('501 ordens, acima do teto de 500')
        expect(describeCancelError(new Error('boom'))).toContain('Não foi possível cancelar')
    })
})
