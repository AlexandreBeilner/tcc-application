import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { useProEntry } from '../../../features/billing/useProEntry'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { useProgressionQuery } from '../../../features/portfolio/useProgressionQuery'
import { AvatarMenu } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../features/billing/useProEntry', () => ({ useProEntry: vi.fn() }))
vi.mock('../../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))
vi.mock('../../../features/portfolio/useProgressionQuery', () => ({ useProgressionQuery: vi.fn() }))

function renderMenu(unlocked: string[], state: { isLoading?: boolean } = {}) {
    vi.mocked(useUnlockedKeys).mockReturnValue({
        unlockedKeys: new Set(unlocked),
        lessons: [],
        isLoading: state.isLoading ?? false,
        isError: false,
    })
    render(
        <MemoryRouter>
            <AvatarMenu />
        </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))
}

describe('AvatarMenu (MO.9.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ user: { name: 'Ana', role: 'user' }, logout: vi.fn() } as unknown as ReturnType<
            typeof useAuth
        >)
        vi.mocked(useProgressionQuery).mockReturnValue({ data: undefined } as ReturnType<typeof useProgressionQuery>)
        vi.mocked(useProEntry).mockReturnValue('visitor')
    })
    afterEach(() => vi.clearAllMocks())

    it('tem o bloco Ferramentas com a Calculadora e não repete Assembleias (já está na barra)', () => {
        renderMenu(['calculator'])

        expect(screen.getByText('Ferramentas')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Calculadora' })).toHaveAttribute('href', '/calculadora')
        expect(screen.queryByRole('menuitem', { name: 'Assembleias' })).toBeNull()
    })

    it('a Calculadora ainda travada pela trilha mostra o cadeado, mas leva à rota (que mostra o bloqueio)', () => {
        renderMenu([])

        const item = screen.getByRole('menuitem', { name: 'Calculadora travada pela trilha' })
        expect(item).toHaveAttribute('href', '/calculadora')
    })

    it('enquanto a trilha carrega não mostra a Calculadora como travada', () => {
        renderMenu([], { isLoading: true })

        expect(screen.getByRole('menuitem', { name: 'Calculadora' })).toBeInTheDocument()
    })

    it('quem não é PRO acha "Plano PRO", que leva aos planos com a origem menu', () => {
        renderMenu(['calculator'])
        expect(screen.getByRole('menuitem', { name: 'Plano PRO' })).toHaveAttribute('href', '/planos')
        expect(screen.queryByRole('menuitem', { name: 'Gerenciar plano' })).toBeNull()
    })

    it('assinante vê "Gerenciar plano" em Configurações e não o convite', () => {
        vi.mocked(useProEntry).mockReturnValue('subscriber')
        renderMenu(['calculator'])
        expect(screen.getByRole('menuitem', { name: 'Gerenciar plano' })).toHaveAttribute('href', '/configuracoes')
        expect(screen.queryByRole('menuitem', { name: 'Plano PRO' })).toBeNull()
    })

    it('sem entrada (carregando ou cobrança desligada) não mostra nenhum dos dois', () => {
        vi.mocked(useProEntry).mockReturnValue(null)
        renderMenu(['calculator'])
        expect(screen.queryByRole('menuitem', { name: 'Plano PRO' })).toBeNull()
        expect(screen.queryByRole('menuitem', { name: 'Gerenciar plano' })).toBeNull()
    })
})
