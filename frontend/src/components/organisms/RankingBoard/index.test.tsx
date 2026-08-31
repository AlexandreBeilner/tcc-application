import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RankingCriterion, RankingEntry, RankingScope } from '../../../services/ranking'
import { RankingBoard } from '.'

function entry(overrides: Partial<RankingEntry>): RankingEntry {
    return { userId: '1', username: 'ana', level: 3, xp: 300, profitabilityPct: 5, ...overrides }
}

function renderBoard(
    entries: RankingEntry[],
    overrides: {
        scope?: RankingScope
        criterion?: RankingCriterion
        currentUserId?: string | null
        requestingUserPosition?: number | null
        page?: number
        pageSize?: number
        totalEntries?: number
        totalPages?: number
        onPageChange?: (page: number) => void
    } = {},
) {
    const props = {
        scope: overrides.scope ?? 'global',
        criterion: overrides.criterion ?? 'overall',
        currentUserId: overrides.currentUserId ?? null,
        requestingUserPosition: overrides.requestingUserPosition ?? null,
        page: overrides.page ?? 1,
        pageSize: overrides.pageSize ?? 25,
        totalEntries: overrides.totalEntries ?? entries.length,
        totalPages: overrides.totalPages ?? 1,
        onPageChange: overrides.onPageChange ?? (() => {}),
    }
    const router = createMemoryRouter(
        [
            { path: '/', element: <RankingBoard entries={entries} {...props} /> },
            { path: '/amigos', element: <div>tela de amigos</div> },
            { path: '/perfil/:id', element: <div>perfil público</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('RankingBoard (tela 7.1)', () => {
    it('mostra o pódio (top 3) e a lista a partir do 4º colocado', () => {
        renderBoard([
            entry({ userId: '1', username: 'ana', profitabilityPct: 12.5 }),
            entry({ userId: '2', username: 'bia', profitabilityPct: 8 }),
            entry({ userId: '3', username: 'caio', profitabilityPct: 3 }),
            entry({ userId: '4', username: 'duda', profitabilityPct: -2 }),
        ])

        expect(screen.getAllByText('1º').length).toBeGreaterThan(0)
        expect(screen.getByText('ana')).toBeInTheDocument()
        expect(screen.getByText('+12,5%')).toBeInTheDocument()
        expect(screen.getByText('duda')).toBeInTheDocument()
        expect(screen.getByText('4º')).toBeInTheDocument()
        expect(screen.getByText('−2,0%')).toBeInTheDocument()
    })

    it('escopo Amigos sem ninguém além do próprio usuário mostra CTA pra buscar amigos (baseado em totalEntries, não na página atual)', () => {
        renderBoard([entry({ userId: 'me', username: 'eu' })], { scope: 'friends', currentUserId: 'me', totalEntries: 1 })

        fireEvent.click(screen.getByRole('button', { name: 'Buscar amigos' }))
        expect(screen.getByText('tela de amigos')).toBeInTheDocument()
    })

    it('escopo Global com um único usuário não mostra o estado de amigos vazio', () => {
        renderBoard([entry({ userId: 'me', username: 'eu' })], { scope: 'global', currentUserId: 'me', totalEntries: 1 })

        expect(screen.queryByRole('button', { name: 'Buscar amigos' })).not.toBeInTheDocument()
        expect(screen.getByText('eu')).toBeInTheDocument()
    })

    it('critério level mostra XP em vez de rentabilidade, sem sparkline', () => {
        renderBoard(
            [
                entry({ userId: '1', username: 'ana', level: 8, xp: 5000, profitabilityPct: null }),
                entry({ userId: '2', username: 'bia', level: 6, xp: 3000, profitabilityPct: null }),
            ],
            { criterion: 'level' },
        )

        expect(screen.getByText('5.000 XP')).toBeInTheDocument()
        expect(screen.getByText('3.000 XP')).toBeInTheDocument()
        expect(document.querySelector('svg[aria-hidden="true"]')).not.toBeInTheDocument()
    })

    it('critério sem dados (ex: fixedIncome vazio) mostra mensagem específica do critério', () => {
        renderBoard([], { criterion: 'fixedIncome', totalEntries: 0 })

        expect(screen.getByText('Ninguém com posição em renda fixa nesta janela ainda.')).toBeInTheDocument()
    })

    it('página > 1 não mostra pódio — só lista com ranking absoluto (offset por pageSize)', () => {
        renderBoard(
            [
                entry({ userId: '26', username: 'user26', profitabilityPct: 1 }),
                entry({ userId: '27', username: 'user27', profitabilityPct: 0.5 }),
            ],
            { page: 2, pageSize: 25, totalEntries: 27, totalPages: 2 },
        )

        expect(screen.queryByText('1º lugar')).not.toBeInTheDocument()
        expect(screen.getByText('26º')).toBeInTheDocument()
        expect(screen.getByText('27º')).toBeInTheDocument()
    })

    it('controles de paginação disparam onPageChange', () => {
        const onPageChange = vi.fn()
        renderBoard([entry({ userId: '1' })], { page: 1, totalPages: 3, onPageChange })

        fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
        expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('sem paginação nenhuma com 1 página só (nada de controle desabilitado ocupando espaço à toa)', () => {
        renderBoard([entry({ userId: '1' })], { page: 1, totalPages: 1 })
        expect(screen.queryByRole('navigation', { name: 'Paginação da classificação' })).not.toBeInTheDocument()
    })

    it('mostra a posição do próprio usuário mesmo fora da página exibida', () => {
        renderBoard([entry({ userId: '1' })], { requestingUserPosition: 47 })
        expect(screen.getByText('Você está em Nº 47')).toBeInTheDocument()
    })

    it('não mostra a posição do próprio usuário quando ele não está no ranking filtrado', () => {
        renderBoard([entry({ userId: '1' })], { requestingUserPosition: null })
        expect(screen.queryByText(/Você está em/)).not.toBeInTheDocument()
    })

    it('clique num card do pódio navega pro perfil público (8.4, tarefa 6.9)', () => {
        renderBoard([
            entry({ userId: '1', username: 'ana' }),
            entry({ userId: '2', username: 'bia' }),
            entry({ userId: '3', username: 'caio' }),
        ])

        fireEvent.click(screen.getByRole('button', { name: /ana/ }))
        expect(screen.getByText('perfil público')).toBeInTheDocument()
    })

    it('clique numa linha da lista (fora do pódio) navega pro perfil público (8.4, tarefa 6.9)', () => {
        renderBoard([
            entry({ userId: '1', username: 'ana' }),
            entry({ userId: '2', username: 'bia' }),
            entry({ userId: '3', username: 'caio' }),
            entry({ userId: '4', username: 'duda' }),
        ])

        fireEvent.click(screen.getByRole('button', { name: /duda/ }))
        expect(screen.getByText('perfil público')).toBeInTheDocument()
    })
})
