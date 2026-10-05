import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAdminUsers } from '../../services/admin'
import type { AdminUserSummary } from '../../services/admin'
import { AdminUsuarios } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ listAdminUsers: vi.fn() }))

const maria: AdminUserSummary = {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    name: 'Maria Souza',
    email: 'maria@example.com',
    username: 'maria',
    role: 'user',
    status: 'active',
    onboarding_completed: true,
    providers: ['password'],
    created_at: '2026-10-01T12:00:00Z',
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminUsuarios />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

// O `Select` do app é um combobox próprio (não um <select> nativo, o gatilho é um botão): abre a lista e clica na opção.
function chooseOption(label: string, option: string) {
    fireEvent.click(screen.getByRole('button', { name: label }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}

const lastFilters = () => vi.mocked(listAdminUsers).mock.calls.at(-1)?.[1]

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAdminUsers).mockResolvedValue({ users: [maria], total: 1 })
})

describe('AdminUsuarios', () => {
    it('lista as contas, sem filtro e com a primeira página', async () => {
        renderPage()
        expect(await screen.findByText('1 conta(s)')).toBeInTheDocument()
        expect(lastFilters()).toMatchObject({ limit: 20, offset: 0 })
        expect((lastFilters() as { q?: string }).q).toBeUndefined()
        expect(within(screen.getByRole('table')).getByRole('link', { name: 'Maria Souza' })).toBeInTheDocument()
    })

    it('a busca só dispara ao enviar e volta pra primeira página', async () => {
        renderPage()
        await screen.findByText('1 conta(s)')
        const calls = vi.mocked(listAdminUsers).mock.calls.length

        fireEvent.change(screen.getByLabelText(/Buscar por nome/), { target: { value: '  maria ' } })
        expect(vi.mocked(listAdminUsers).mock.calls.length).toBe(calls)
        fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

        await waitFor(() => expect(lastFilters()).toMatchObject({ q: 'maria', offset: 0 }))
    })

    it('filtros de status e provedor entram na consulta', async () => {
        renderPage()
        await screen.findByText('1 conta(s)')

        chooseOption('Filtrar por status', 'Suspensas')
        await waitFor(() => expect(lastFilters()).toMatchObject({ status: 'suspended' }))
        chooseOption('Filtrar por provedor de login', 'Google')
        await waitFor(() => expect(lastFilters()).toMatchObject({ status: 'suspended', provider: 'google' }))
    })

    it('datas viram intervalo ISO do dia inteiro e um intervalo invertido é ignorado com aviso', async () => {
        renderPage()
        await screen.findByText('1 conta(s)')

        fireEvent.change(screen.getByLabelText('Cadastro a partir de'), { target: { value: '2026-10-01' } })
        fireEvent.change(screen.getByLabelText('Cadastro até'), { target: { value: '2026-10-05' } })
        await waitFor(() => {
            const filters = lastFilters() as { created_from?: string; created_to?: string }
            expect(filters.created_from).toMatch(/^2026-10-01T|^2026-09-30T/)
            expect(filters.created_to).toMatch(/^2026-10-0[56]T/)
        })

        fireEvent.change(screen.getByLabelText('Cadastro até'), { target: { value: '2026-09-01' } })
        expect(await screen.findByRole('alert')).toHaveTextContent('A data inicial precisa ser anterior')
        await waitFor(() => expect((lastFilters() as { created_from?: string }).created_from).toBeUndefined())
    })

    it('mostra erro de carregamento e lista vazia', async () => {
        vi.mocked(listAdminUsers).mockRejectedValueOnce(new Error('falhou'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários')
    })

    it('lista vazia mostra a mensagem do filtro', async () => {
        vi.mocked(listAdminUsers).mockResolvedValue({ users: [], total: 0 })
        renderPage()
        expect(await screen.findByText('Nenhuma conta com esse filtro.')).toBeInTheDocument()
    })
})
