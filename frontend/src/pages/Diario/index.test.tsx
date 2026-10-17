import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { RewardRevealProvider } from '../../features/shell/RewardRevealProvider'
import { Diario } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))

describe('Diario (DI.4.1)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('mostra o título e entrega o palco ao jogo (desligado: mensagem do módulo)', async () => {
        vi.mocked(useAuth).mockReturnValue({ token: 't', logout: vi.fn() } as unknown as ReturnType<typeof useAuth>)
        vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ status: 'off' }), { status: 200 }))
        render(
            <QueryClientProvider client={new QueryClient()}>
                <RewardRevealProvider>
                    <Diario />
                </RewardRevealProvider>
            </QueryClientProvider>,
        )
        expect(screen.getByRole('heading', { level: 1, name: 'Diário Selucra' })).toBeTruthy()
        expect(await screen.findByText('O Diário Selucra não está disponível agora.')).toBeTruthy()
    })
})
