import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyUpdate, isUpdateWaiting, markUpdateWaiting, resetUpdateStore, subscribeToUpdate } from '.'

describe('updateStore (LW.2.2)', () => {
    beforeEach(() => resetUpdateStore())

    it('começa sem versão esperando', () => {
        expect(isUpdateWaiting()).toBe(false)
    })

    it('avisa quem assina quando uma versão fica esperando, e não aplica sozinha', () => {
        const listener = vi.fn()
        const apply = vi.fn()
        subscribeToUpdate(listener)

        markUpdateWaiting(apply)

        expect(isUpdateWaiting()).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)
        expect(apply).not.toHaveBeenCalled()
    })

    it('aplica a atualização só quando pedido', () => {
        const apply = vi.fn()
        markUpdateWaiting(apply)

        applyUpdate()

        expect(apply).toHaveBeenCalledTimes(1)
    })

    it('quem cancela a assinatura deixa de ser avisado', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeToUpdate(listener)
        unsubscribe()

        markUpdateWaiting(vi.fn())

        expect(listener).not.toHaveBeenCalled()
    })
})
