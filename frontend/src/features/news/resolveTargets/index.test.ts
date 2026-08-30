import { describe, expect, it } from 'vitest'
import { resolveTargets } from '.'

describe('resolveTargets', () => {
    it('resolve asset_id pro label em assetLabels, navegável', () => {
        const result = resolveTargets([{ asset_id: 'asset-1' }], { 'asset-1': 'BNDD4 · Banco D S.A.' })
        expect(result).toEqual([{ key: 'asset-asset-1', label: 'BNDD4 · Banco D S.A.', assetId: 'asset-1' }])
    })

    it('asset_id sem label conhecido cai pro próprio id, ainda navegável', () => {
        const result = resolveTargets([{ asset_id: 'asset-2' }], {})
        expect(result).toEqual([{ key: 'asset-asset-2', label: 'asset-2', assetId: 'asset-2' }])
    })

    it('sector vira texto sem navegação', () => {
        const result = resolveTargets([{ sector: 'Financeiro' }], {})
        expect(result).toEqual([{ key: 'sector-0-Financeiro', label: 'Setor: Financeiro', assetId: undefined }])
    })

    it('risk_class vira texto sem navegação', () => {
        const result = resolveTargets([{ risk_class: 'alto' }], {})
        expect(result).toEqual([{ key: 'risk-0-alto', label: 'Risco: alto', assetId: undefined }])
    })

    it('resolve múltiplos targets mistos preservando a ordem', () => {
        const result = resolveTargets([{ sector: 'Financeiro' }, { asset_id: 'asset-1' }, { risk_class: 'alto' }], {
            'asset-1': 'BNDD4 · Banco D S.A.',
        })
        expect(result.map((r) => r.label)).toEqual(['Setor: Financeiro', 'BNDD4 · Banco D S.A.', 'Risco: alto'])
    })

    it('lista vazia devolve array vazio', () => {
        expect(resolveTargets([], {})).toEqual([])
    })
})
