import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { ApiError } from '../../services/client'
import { cancelDuel, getDuel, respondToDuel } from '../../services/duels'
import type { Duel } from '../../services/duels'
import { getMyCosmetics } from '../../services/cosmetics'
import { DuelDetalhe } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/duels', () => ({ getDuel: vi.fn(), respondToDuel: vi.fn(), cancelDuel: vi.fn() }))
vi.mock('../../services/cosmetics', () => ({ getMyCosmetics: vi.fn() }))

const duel = (overrides: Partial<Duel>): Duel => ({
    id: 'd1',
    status: 'active',
    role: 'challenger',
    opponent: { id: 'u2', username: 'bia', name: 'Bia', avatarUrl: null, cosmetics: { frame: null, title: null } },
    createdAt: '2026-10-01T00:00:00Z',
    expiresAt: '2026-10-08T00:00:00Z',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-08T00:00:00Z',
    finishedAt: null,
    result: null,
    reason: null,
    you: { returnPct: 2, operated: true },
    them: { returnPct: 1, operated: false },
    ...overrides,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/duelos/d1']}>
                <Routes>
                    <Route path="/duelos/:id" element={<DuelDetalhe />} />
                    <Route path="/duelos" element={<p>lista de duelos</p>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('DuelDetalhe (MO.5.3)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', username: 'ana', avatarUrl: null },
        } as ReturnType<typeof useAuth>)
        vi.mocked(getMyCosmetics).mockResolvedValue({
            referralCount: 0,
            catalog: [],
            selection: { frame: null, title: null },
            display: { frame: null, title: null },
        })
    })
    afterEach(() => vi.clearAllMocks())

    it('em andamento mostra o placar parcial e não oferece cancelar', async () => {
        vi.mocked(getDuel).mockResolvedValue(duel({}))
        renderPage()

        expect(await screen.findByText('+2,0%')).toBeInTheDocument()
        expect(screen.getByText(/Placar parcial de agora/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Cancelar desafio' })).toBeNull()
    })

    it('convidado aceita sem plano; quem desafiou cancela enquanto aguarda', async () => {
        vi.mocked(getDuel).mockResolvedValue(duel({ status: 'pending', role: 'opponent', you: null, them: null }))
        vi.mocked(respondToDuel).mockResolvedValue(undefined)
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Aceitar' }))
        await waitFor(() => expect(respondToDuel).toHaveBeenCalledWith('token', 'd1', true))
    })

    it('quem desafiou pode cancelar um desafio aguardando', async () => {
        vi.mocked(getDuel).mockResolvedValue(duel({ status: 'pending', role: 'challenger', you: null, them: null }))
        vi.mocked(cancelDuel).mockResolvedValue(undefined)
        renderPage()

        expect(await screen.findByText(/Aguardando Bia responder/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar desafio' }))

        await waitFor(() => expect(cancelDuel).toHaveBeenCalledWith('token', 'd1'))
        expect(await screen.findByText('lista de duelos')).toBeInTheDocument()
    })

    it('encerrado mostra o resultado e o motivo', async () => {
        vi.mocked(getDuel).mockResolvedValue(duel({ status: 'finished', result: 'won', reason: 'abandonment' }))
        renderPage()
        expect(await screen.findByText('Quem não operou durante o duelo perde por abandono.')).toBeInTheDocument()
    })

    it('duelo inexistente mostra mensagem amigável', async () => {
        vi.mocked(getDuel).mockRejectedValue(new ApiError(404, 'duelo não encontrado'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Duelo não encontrado')
    })
})
