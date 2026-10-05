import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import type { TradingHalt } from '../../../services/admin'
import { describeHaltError, haltedAssetIds, hasGlobalHalt } from '.'

const base: TradingHalt = {
    id: 'h1',
    scope: 'asset',
    asset_id: 'a1',
    ticker: 'ACME3',
    reason: 'm',
    created_by: 'admin',
    created_at: '2026-10-03T12:00:00Z',
    lifted_at: null,
    lifted_by: null,
}

describe('tradingHalts', () => {
    it('lista os ativos pausados e ignora a pausa global', () => {
        const global: TradingHalt = { ...base, id: 'h2', scope: 'global', asset_id: null, ticker: null }
        expect([...haltedAssetIds([base, global])]).toEqual(['a1'])
        expect(hasGlobalHalt([base])).toBe(false)
        expect(hasGlobalHalt([base, global])).toBe(true)
    })

    it('descreve os erros conhecidos do motor', () => {
        expect(describeHaltError(new ApiError(409, 'x'))).toContain('mudou')
        expect(describeHaltError(new ApiError(404, 'x'))).toContain('não existe mais')
        expect(describeHaltError(new ApiError(400, 'x'))).toContain('recusou')
        expect(describeHaltError(new Error('boom'))).toContain('Não foi possível concluir')
    })
})
