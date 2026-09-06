import { fireEvent, render, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AssetSummary } from '../../../services/market'
import { useUnlockedKeys } from '../../lessons/useUnlockedKeys'
import { useLockedAssetGate } from '.'

vi.mock('../../lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))

function asset(overrides: Partial<AssetSummary> = {}): AssetSummary {
    return { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, ...overrides }
}

function renderGate() {
    return renderHook(() => useLockedAssetGate(), { wrapper: MemoryRouter })
}

function SelectProbe({ asset, detailPath }: { asset: AssetSummary; detailPath: string }) {
    const gate = useLockedAssetGate()
    return (
        <>
            <button type="button" onClick={() => gate.selectOrRedirectToLesson(asset, detailPath)}>
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

    it('selectOrRedirectToLesson navega pro detalhe quando o ativo está desbloqueado', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(['asset:acao']), lessons: [], isLoading: false, isError: false })

        const { getByText } = render(
            <MemoryRouter initialEntries={['/mercado/ativos']}>
                <SelectProbe asset={asset()} detailPath="/mercado/ativos/a1" />
            </MemoryRouter>,
        )

        fireEvent.click(getByText('selecionar'))

        expect(getByText('/mercado/ativos/a1')).toBeInTheDocument()
    })

    it('selectOrRedirectToLesson redireciona pra /trilha/:id da lição que desbloqueia quando o ativo está travado', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [
                {
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
                    status: 'available',
                    currentStep: 0,
                },
            ],
            isLoading: false,
            isError: false,
        })

        const { getByText } = render(
            <MemoryRouter initialEntries={['/mercado/ativos']}>
                <SelectProbe asset={asset()} detailPath="/mercado/ativos/a1" />
            </MemoryRouter>,
        )

        fireEvent.click(getByText('selecionar'))

        expect(getByText('/trilha/lesson-2-3')).toBeInTheDocument()
    })
})
