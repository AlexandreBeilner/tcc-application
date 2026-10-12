import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getEmailPreferences, updateEmailPreferences } from '../../../services/emailPreferences'
import { EmailPreferencesSection } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/emailPreferences', () => ({
    getEmailPreferences: vi.fn(),
    updateEmailPreferences: vi.fn(),
}))

function renderSection() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <EmailPreferencesSection />
        </QueryClientProvider>,
    )
}

describe('EmailPreferencesSection (EM.6.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'tk',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('conta nova: as duas categorias aparecem desligadas e o texto explica o que é obrigatório', async () => {
        vi.mocked(getEmailPreferences).mockResolvedValue({ preferences: { social: false, engagement: false }, suppression: null })

        renderSection()

        const social = await screen.findByRole('checkbox', { name: /Amigos/ })
        expect(social).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: /Resumo e lembretes/ })).not.toBeChecked()
        expect(screen.getByText(/sempre são enviados/)).toBeInTheDocument()
        expect(screen.queryByText(/spam/)).not.toBeInTheDocument()
    })

    it('ligar uma categoria grava só ela e reflete o estado devolvido', async () => {
        vi.mocked(getEmailPreferences).mockResolvedValue({ preferences: { social: false, engagement: false }, suppression: null })
        vi.mocked(updateEmailPreferences).mockResolvedValue({ preferences: { social: false, engagement: true } })

        renderSection()
        fireEvent.click(await screen.findByRole('checkbox', { name: /Resumo e lembretes/ }))

        await waitFor(() => expect(updateEmailPreferences).toHaveBeenCalledWith('tk', { engagement: true }))
        await waitFor(() => expect(screen.getByRole('checkbox', { name: /Resumo e lembretes/ })).toBeChecked())
        expect(screen.getByRole('checkbox', { name: /Amigos/ })).not.toBeChecked()
    })

    it('mostra o aviso quando o endereço teve bounce ou reclamação', async () => {
        vi.mocked(getEmailPreferences).mockResolvedValue({ preferences: { social: true, engagement: false }, suppression: 'bounce' })

        renderSection()

        expect(await screen.findByText(/Não conseguimos entregar e-mails/)).toBeInTheDocument()
    })

    it('erro ao salvar mostra a mensagem e não marca a caixa', async () => {
        vi.mocked(getEmailPreferences).mockResolvedValue({ preferences: { social: false, engagement: false }, suppression: null })
        vi.mocked(updateEmailPreferences).mockRejectedValue(new Error('falhou'))

        renderSection()
        fireEvent.click(await screen.findByRole('checkbox', { name: /Amigos/ }))

        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: /Amigos/ })).not.toBeChecked()
    })
})
