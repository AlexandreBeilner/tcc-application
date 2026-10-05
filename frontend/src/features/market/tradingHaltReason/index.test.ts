import { describe, expect, it } from 'vitest'
import { describeTradingHalt } from '.'

describe('describeTradingHalt', () => {
    it('sem pausa não barra nada', () => {
        expect(describeTradingHalt({ global: false, asset_ids: [] }, 'a1')).toBeNull()
    })

    it('pausa de outro ativo não barra este', () => {
        expect(describeTradingHalt({ global: false, asset_ids: ['a2'] }, 'a1')).toBeNull()
    })

    it('pausa do ativo avisa que é só neste ativo', () => {
        expect(describeTradingHalt({ global: false, asset_ids: ['a1'] }, 'a1')).toContain('neste ativo')
    })

    it('pausa global vence a do ativo', () => {
        expect(describeTradingHalt({ global: true, asset_ids: ['a1'] }, 'a1')).toContain('todo o mercado')
    })
})
