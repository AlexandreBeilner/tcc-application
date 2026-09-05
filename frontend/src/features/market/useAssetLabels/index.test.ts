import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAssetLabels } from '.'
import type { AssetSummary } from '../../../services/market'

function asset(id: string, ticker: string, name: string): AssetSummary {
    return { id, ticker, name, type: 'acao', is_sandbox: false }
}

describe('features/market/useAssetLabels', () => {
    it('mapeia asset_id pra "TICKER · Nome"', () => {
        const { result } = renderHook(() => useAssetLabels([asset('a1', 'PETR4', 'Petrobras')]))

        expect(result.current).toEqual({ a1: 'PETR4 · Petrobras' })
    })

    it('lista vazia/undefined devolve mapa vazio, sem quebrar', () => {
        expect(renderHook(() => useAssetLabels(undefined)).result.current).toEqual({})
        expect(renderHook(() => useAssetLabels([])).result.current).toEqual({})
    })
})
