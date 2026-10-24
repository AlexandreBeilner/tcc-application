import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { ApiError } from '../../../services/client'
import { equipCosmetic, getMyCosmetics, unequipCosmetic } from '../../../services/cosmetics'
import type { MyCosmetics } from '../../../services/cosmetics'
import { CosmeticsPicker } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/cosmetics', () => ({
    getMyCosmetics: vi.fn(),
    equipCosmetic: vi.fn(),
    unequipCosmetic: vi.fn(),
}))

const CATALOG: MyCosmetics['catalog'] = [
    { key: 'frame_aurora', kind: 'frame', name: 'Aurora', description: 'Verde-água e azul.', sortOrder: 10, unlockReferrals: null },
    {
        key: 'title_estrategista',
        kind: 'title',
        name: 'Estrategista',
        description: 'Monta o plano antes.',
        sortOrder: 10,
        unlockReferrals: null,
    },
    { key: 'title_mensageiro', kind: 'title', name: 'Mensageiro', description: 'Trouxe 5 amigos.', sortOrder: 90, unlockReferrals: 5 },
]

function mine(overrides: Partial<MyCosmetics> = {}): MyCosmetics {
    return {
        referralCount: 0,
        catalog: CATALOG,
        selection: { frame: null, title: null },
        display: { frame: null, title: null },
        ...overrides,
    }
}

function renderPicker() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <CosmeticsPicker username="ana" avatarUrl={null} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('CosmeticsPicker (MO.5.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        localStorage.clear()
    })
    afterEach(() => vi.clearAllMocks())

    it('escolhe uma moldura e vê o estado novo', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(mine())
        vi.mocked(equipCosmetic).mockResolvedValue(
            mine({ selection: { frame: 'frame_aurora', title: null }, display: { frame: 'frame_aurora', title: null } }),
        )
        renderPicker()

        const option = await screen.findByRole('button', { name: /Aurora/ })
        expect(option).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(option)

        await waitFor(() => expect(equipCosmetic).toHaveBeenCalledWith('token', 'frame', 'frame_aurora'))
        await waitFor(() => expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true'))
    })

    it('"Sem título" tira o título', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(
            mine({ selection: { frame: null, title: 'title_estrategista' }, display: { frame: null, title: 'Estrategista' } }),
        )
        vi.mocked(unequipCosmetic).mockResolvedValue(mine())
        renderPicker()

        fireEvent.click(await screen.findByRole('button', { name: 'Sem título' }))

        await waitFor(() => expect(unequipCosmetic).toHaveBeenCalledWith('token', 'title'))
    })

    it('título liberado por convites aparece bloqueado com o motivo e libera ao alcançar o marco', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(mine({ referralCount: 2 }))
        const { unmount } = renderPicker()
        const locked = await screen.findByRole('button', { name: /Mensageiro/ })
        expect(locked).toBeDisabled()
        expect(locked).toHaveTextContent('Libera com 5 amigos')
        unmount()

        vi.mocked(getMyCosmetics).mockResolvedValue(mine({ referralCount: 5 }))
        renderPicker()
        expect(await screen.findByRole('button', { name: /Mensageiro/ })).toBeEnabled()
    })

    it('erro da API vira mensagem na tela', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(mine())
        vi.mocked(equipCosmetic).mockRejectedValue(new ApiError(500, 'falha'))
        renderPicker()

        fireEvent.click(await screen.findByRole('button', { name: /Aurora/ }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar a escolha')
    })
})
