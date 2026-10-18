import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getMyReferral } from '../../../services/referral'
import { ShareResultButton } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/referral', () => ({ getMyReferral: vi.fn() }))

const card = { lessonTitle: 'Inflação', headline: '4 de 5', caption: 'de primeira' }

function renderButton() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <ShareResultButton message="Fiz a lição no Selucra: 4 de 5 de primeira." card={card} />
        </QueryClientProvider>,
    )
}

describe('ShareResultButton (LJ.5.10)', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })
    afterEach(() => vi.clearAllMocks())

    it('sem navigator.share copia o texto com o link de convite da pessoa', async () => {
        vi.mocked(getMyReferral).mockResolvedValue({ code: 'ABCD2345' } as never)
        renderButton()

        fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))

        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith(
                `Fiz a lição no Selucra: 4 de 5 de primeira. ${window.location.origin}/login?ref=ABCD2345`,
            ),
        )
        expect(await screen.findByText('Texto copiado. É só colar onde quiser.')).toBeInTheDocument()
    })

    it('se o código de convite não carregar, o texto sai com o endereço do app', async () => {
        vi.mocked(getMyReferral).mockRejectedValue(new Error('rede'))
        renderButton()

        fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))

        await waitFor(() => expect(writeText).toHaveBeenCalledWith(`Fiz a lição no Selucra: 4 de 5 de primeira. ${window.location.origin}`))
    })

    it('não busca o convite antes de a pessoa tocar', () => {
        renderButton()

        expect(getMyReferral).not.toHaveBeenCalled()
    })
})
