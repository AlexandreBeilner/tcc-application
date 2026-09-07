import { fireEvent, render, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AssetSummary } from '../../../services/market'
import type { Lesson } from '../../../services/lessons'
import { useUnlockedKeys } from '../../lessons/useUnlockedKeys'
import { useLockedAssetGate } from '.'

vi.mock('../../lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))

function asset(overrides: Partial<AssetSummary> = {}): AssetSummary {
    return { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, ...overrides }
}

function lesson(overrides: Partial<Lesson> = {}): Lesson {
    return {
        id: 'lesson-2-3',
        code: '2.3',
        title: 'Nomenclatura de tickers',
        trackNumber: 2,
        trackName: 'Renda Variável',
        sortOrder: 10,
        centralConcept: 'x',
        scenarioText: '',
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: '',
        unlocksDescription: '',
        unlocksKeys: ['asset:acao'],
        unlocksAssetTicker: null,
        microDecisionOptions: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

function renderGate() {
    return renderHook(() => useLockedAssetGate(), { wrapper: MemoryRouter })
}

function SelectProbe({ detailPath }: { detailPath: string }) {
    const gate = useLockedAssetGate()
    return (
        <>
            <button type="button" onClick={() => gate.selectAsset(detailPath)}>
                selecionar
            </button>
            <span>{useLocation().pathname}</span>
        </>
    )
}

describe('useLockedAssetGate', () => {
    it('isLocked é false pra ativo sandbox, mesmo sem nenhuma chave desbloqueada (RF12)', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })
        const { result } = renderGate()

        expect(result.current.isLocked(asset({ is_sandbox: true }))).toBe(false)
    })

    it('isLocked é true pra ativo real cuja chave não está desbloqueada', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })
        const { result } = renderGate()

        expect(result.current.isLocked(asset())).toBe(true)
    })

    it('isLocked é false pra ativo real já desbloqueado', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(['asset:acao']), lessons: [], isLoading: false, isError: false })
        const { result } = renderGate()

        expect(result.current.isLocked(asset())).toBe(false)
    })

    it('lockedBadge não renderiza nada pra ativo desbloqueado', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(['asset:acao']), lessons: [], isLoading: false, isError: false })
        const { result } = renderGate()

        expect(result.current.lockedBadge(asset())).toBeNull()
    })

    it('unlockingLessonFor acha a lição que cobre a chave do ativo', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [lesson()], isLoading: false, isError: false })
        const { result } = renderGate()

        expect(result.current.unlockingLessonFor(asset())).toEqual({ id: 'lesson-2-3', code: '2.3', title: 'Nomenclatura de tickers' })
    })

    it('unlockingLessonFor devolve undefined quando nenhuma lição seedada ainda cobre a chave', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })
        const { result } = renderGate()

        expect(result.current.unlockingLessonFor(asset())).toBeUndefined()
    })

    // Tarefa J.3: `selectAsset` navega sempre pro Detalhe, travado ou não —
    // é o Detalhe (não a lição) quem passa a decidir a UI de bloqueio
    // (`AssetDetail`, `useLockedAssetGate.isLocked`/`unlockingLessonFor`).
    it('selectAsset navega pro detalhe passado, independente do estado de bloqueio', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [lesson()], isLoading: false, isError: false })

        const { getByText } = render(
            <MemoryRouter initialEntries={['/mercado/ativos']}>
                <SelectProbe detailPath="/mercado/ativos/a1" />
            </MemoryRouter>,
        )

        fireEvent.click(getByText('selecionar'))

        expect(getByText('/mercado/ativos/a1')).toBeInTheDocument()
    })
})
