import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { TabBar } from '.'

vi.mock('../../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))

function renderTabBar(unlockedKeys: Set<string>) {
    vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys, lessons: [], isLoading: false })
    return render(
        <MemoryRouter>
            <TabBar />
        </MemoryRouter>,
    )
}

describe('TabBar', () => {
    it('Portfólio e Calculadora aparecem travados (sem link) antes de 0.1/0.2', () => {
        renderTabBar(new Set())

        const portfolio = screen.getByText('Portfólio').closest('[aria-disabled]')
        expect(portfolio).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('Portfólio').closest('a')).not.toBeInTheDocument()

        const calculadora = screen.getByText('Calculadora').closest('[aria-disabled]')
        expect(calculadora).toHaveAttribute('aria-disabled', 'true')
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
})
