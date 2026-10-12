import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { TabBar } from '.'

vi.mock('../../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))

function LocationDisplay() {
    return <div data-testid="location">{useLocation().pathname}</div>
}

function lesson(overrides: Partial<Lesson> = {}): Lesson {
    return {
        id: 'lesson-1',
        code: '1.1',
        title: 'Renda fixa na prática',
        sortOrder: 1,
        status: 'available',
        unlocksKeys: ['portfolio'],
        unlocksDescription: '',
        ...overrides,
    } as Lesson
}

function renderTabBar(
    unlockedKeys: Set<string>,
    state: { isLoading?: boolean; isError?: boolean; lessons?: Lesson[]; initialPath?: string } = {},
) {
    vi.mocked(useUnlockedKeys).mockReturnValue({
        unlockedKeys,
        lessons: state.lessons ?? [],
        isLoading: state.isLoading ?? false,
        isError: state.isError ?? false,
    })
    return render(
        <MemoryRouter initialEntries={[state.initialPath ?? '/']}>
            <LocationDisplay />
            <TabBar />
        </MemoryRouter>,
    )
}

describe('TabBar', () => {
    it('a barra tem sempre Portfólio, Trilha, Mercado, Assembleias e Classificação, nessa ordem, sem Calculadora (MO.9.6)', () => {
        renderTabBar(new Set(['portfolio']))

        const labels = within(screen.getByRole('navigation', { name: 'Navegação principal' }))
            .getAllByText(/Portfólio|Trilha|Mercado|Assembleias|Classificação|Calculadora/)
            .map((node) => node.textContent)
        expect(labels).toEqual(['Portfólio', 'Trilha', 'Mercado', 'Assembleias', 'Classificação'])
    })

    it('Portfólio aparece travado (sem link) antes da lição 0.1', () => {
        renderTabBar(new Set())

        expect(screen.getByRole('button', { name: /Portfólio travado/ })).toBeInTheDocument()
        expect(screen.getByText('Portfólio').closest('a')).not.toBeInTheDocument()
    })

    it('Trilha/Mercado/Assembleias/Classificação nunca ficam travadas, mesmo sem nenhum desbloqueio', () => {
        renderTabBar(new Set())

        expect(screen.getByText('Trilha').closest('a')).toBeInTheDocument()
        expect(screen.getByText('Mercado').closest('a')).toBeInTheDocument()
        expect(screen.getByText('Assembleias').closest('a')).toHaveAttribute('href', '/assembleias')
        expect(screen.getByText('Classificação').closest('a')).toBeInTheDocument()
    })

    it('Portfólio vira link normal depois de desbloqueado', () => {
        renderTabBar(new Set(['portfolio']))

        expect(screen.getByText('Portfólio').closest('a')).toHaveAttribute('href', '/')
    })

    it('enquanto GET /lessons ainda carrega, não mostra nenhuma aba como travada', () => {
        renderTabBar(new Set(), { isLoading: true })

        expect(screen.getByText('Portfólio').closest('a')).toBeInTheDocument()
    })

    it('numa falha de GET /lessons, não mostra nenhuma aba como travada', () => {
        renderTabBar(new Set(), { isError: true })

        expect(screen.getByText('Portfólio').closest('a')).toBeInTheDocument()
    })

    it('tocar numa aba travada navega pra própria rota da aba, nunca pra outro lugar (Fase Q, bloqueio é parede)', () => {
        renderTabBar(new Set(), {
            initialPath: '/mercado',
            lessons: [lesson({ id: 'lesson-42', code: '0.1', unlocksKeys: ['portfolio'] })],
        })

        fireEvent.click(screen.getByRole('button', { name: 'Portfólio travado pela trilha' }))

        // Nunca redireciona pra lição/Mapa da Trilha: a própria rota "/" já
        // está protegida por `RequiresUnlock`, que renderiza `LockedGate`
        // (o card de bloqueio) no lugar do `Portfolio` real.
        expect(screen.getByTestId('location')).toHaveTextContent('/')
    })

    it('aba travada nunca mostra o código da lição em texto visível (Fase Q)', () => {
        renderTabBar(new Set(), { lessons: [lesson({ id: 'lesson-42', code: '0.1', unlocksKeys: ['portfolio'] })] })

        expect(screen.queryByText(/^Lição /)).not.toBeInTheDocument()
    })
})
