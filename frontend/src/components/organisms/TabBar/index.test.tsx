import { fireEvent, render, screen } from '@testing-library/react'
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
    it('Portfólio e Calculadora aparecem travados (sem link) antes de 0.1/0.2', () => {
        renderTabBar(new Set())

        const portfolio = screen.getByRole('button', { name: /Portfólio travado/ })
        expect(portfolio).toBeInTheDocument()
        expect(screen.getByText('Portfólio').closest('a')).not.toBeInTheDocument()

        expect(screen.getByRole('button', { name: /Calculadora travado/ })).toBeInTheDocument()
    })

    it('Trilha/Mercado/Classificação nunca ficam travadas, mesmo sem nenhum desbloqueio', () => {
        renderTabBar(new Set())

        expect(screen.getByText('Trilha').closest('a')).toBeInTheDocument()
        expect(screen.getByText('Mercado').closest('a')).toBeInTheDocument()
        expect(screen.getByText('Classificação').closest('a')).toBeInTheDocument()
    })

    it('Portfólio e Calculadora viram link normal depois de desbloqueados', () => {
        renderTabBar(new Set(['portfolio', 'calculator']))

        expect(screen.getByText('Portfólio').closest('a')).toHaveAttribute('href', '/')
        expect(screen.getByText('Calculadora').closest('a')).toHaveAttribute('href', '/calculadora')
    })

    it('enquanto GET /lessons ainda carrega, não mostra nenhuma aba como travada', () => {
        renderTabBar(new Set(), { isLoading: true })

        expect(screen.getByText('Portfólio').closest('a')).toBeInTheDocument()
        expect(screen.getByText('Calculadora').closest('a')).toBeInTheDocument()
    })

    it('numa falha de GET /lessons, não mostra nenhuma aba como travada', () => {
        renderTabBar(new Set(), { isError: true })

        expect(screen.getByText('Portfólio').closest('a')).toBeInTheDocument()
        expect(screen.getByText('Calculadora').closest('a')).toBeInTheDocument()
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

    it('tocar na Calculadora travada navega pra "/calculadora", nunca pra outro lugar', () => {
        renderTabBar(new Set(), { initialPath: '/mercado', lessons: [] })

        fireEvent.click(screen.getByRole('button', { name: 'Calculadora travado pela trilha' }))

        expect(screen.getByTestId('location')).toHaveTextContent('/calculadora')
    })

    it('aba travada nunca mostra o código da lição em texto visível (Fase Q)', () => {
        renderTabBar(new Set(), { lessons: [lesson({ id: 'lesson-42', code: '0.1', unlocksKeys: ['portfolio'] })] })

        expect(screen.queryByText(/^Lição /)).not.toBeInTheDocument()
    })
})
