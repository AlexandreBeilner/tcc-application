import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../features/auth/AuthContext'
import { Onboarding } from '.'

const TOKEN_STORAGE_KEY = 'tcc.auth.token'

// Regressão de um bug encontrado na validação de ponta a ponta da tarefa
// 6.2 (docker compose up + Chrome real): com <AuthContext> de verdade (não
// mockado, diferente de Onboarding.test.tsx), `setUser` no fim de
// `finish()` reflete `onboardingCompleted: true` e re-renderiza
// <Onboarding> (ainda montado, mesmo lote de commits) antes do router
// trocar de rota — sem a guarda `!isSubmitting` (Onboarding.tsx), o
// `<Navigate to="/">` da guarda "onboarding já concluído" sobrepunha o
// `navigate('/trilha')` intencional do botão "Começar", e o usuário caía
// no Portfólio em vez da Trilha. Só reproduz com o Provider real porque um
// `useAuth` mockado (Onboarding.test.tsx) não re-renderiza sozinho quando
// `setUser` é chamado.
function renderRealOnboarding() {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token-valido')
    const router = createMemoryRouter(
        [
            { path: '/onboarding', element: <Onboarding /> },
            { path: '/trilha', element: <div>mapa da trilha</div> },
            { path: '/', element: <div>portfolio</div> },
        ],
        { initialEntries: ['/onboarding'] },
    )
    return render(
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>,
    )
}

describe('Onboarding + AuthContext real (regressão da corrida setUser/navigate)', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        localStorage.clear()
    })

    it('"Começar" navega pra /trilha, não pra "/", mesmo com o contexto real re-renderizando no meio do caminho', async () => {
        const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
            if (input === '/auth/me') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: {
                            id: '1',
                            name: 'Ana',
                            email: 'ana@example.com',
                            username: 'ana',
                            role: 'user',
                            onboardingCompleted: false,
                            avatarUrl: null,
                        },
                    }),
                })
            }
            if (input === '/me' && init?.method === 'PATCH') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: {
                            id: '1',
                            name: 'Ana',
                            email: 'ana@example.com',
                            username: 'ana',
                            role: 'user',
                            onboardingCompleted: true,
                            avatarUrl: null,
                        },
                    }),
                })
            }
            throw new Error(`chamada inesperada: ${input}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        renderRealOnboarding()

        await waitFor(() => expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument())
        screen.getByText('Pular').click()

        await waitFor(() => expect(screen.getByText('mapa da trilha')).toBeInTheDocument())
        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
    })
})
