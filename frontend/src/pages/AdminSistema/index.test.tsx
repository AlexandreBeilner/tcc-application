import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../features/admin/AdminReauth'
import { useAuth } from '../../features/auth/AuthContext'
import { createAnnouncement, endAnnouncement, listAdminAnnouncements, startMaintenance } from '../../services/admin'
import type { AdminAnnouncement } from '../../services/admin'
import { AdminSistema } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminAnnouncements: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    endAnnouncement: vi.fn(),
    startMaintenance: vi.fn(),
}))

const announcement = (overrides: Partial<AdminAnnouncement>): AdminAnnouncement => ({
    id: 'a1',
    title: 'Evento extraordinário',
    body: 'Vamos avançar 5 dias.',
    severity: 'warning',
    kind: 'notice',
    dismissible: true,
    starts_at: '2026-10-06T10:00:00Z',
    ends_at: null,
    linked_halt_id: null,
    status: 'active',
    created_at: '2026-10-06T09:00:00Z',
    ...overrides,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminReauthProvider>
                    <AdminSistema />
                </AdminReauthProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAdminAnnouncements).mockResolvedValue({ announcements: [] })
})

describe('AdminSistema (N.20)', () => {
    it('lista os comunicados com o estado e oferece encerrar o que está no ar', async () => {
        vi.mocked(listAdminAnnouncements).mockResolvedValue({
            announcements: [announcement({}), announcement({ id: 'a2', title: 'Antigo', status: 'ended' })],
        })
        renderPage()

        expect(await screen.findByText('Evento extraordinário')).toBeInTheDocument()
        expect(screen.getByText('No ar')).toBeInTheDocument()
        expect(screen.getByText('Encerrado')).toBeInTheDocument()
        // Só o que não terminou tem ação.
        expect(screen.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(1)
    })

    it('recusa o texto com < ou > antes de chamar o servidor', async () => {
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/Evento extraordinário no mercado/), { target: { value: 'Aviso' } })
        fireEvent.change(screen.getByPlaceholderText(/avançar 5 dias/), { target: { value: 'veja <b>isto</b>' } })
        fireEvent.click(screen.getByRole('button', { name: 'Publicar comunicado' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('não use os sinais < e >')
        expect(createAnnouncement).not.toHaveBeenCalled()
    })

    it('publica o comunicado: início vazio não é enviado e fim vazio vai como null', async () => {
        vi.mocked(createAnnouncement).mockResolvedValue(announcement({}))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/Evento extraordinário no mercado/), { target: { value: '  Aviso  ' } })
        fireEvent.change(screen.getByPlaceholderText(/avançar 5 dias/), { target: { value: 'Texto simples' } })
        fireEvent.click(screen.getByRole('button', { name: 'Publicar comunicado' }))

        await waitFor(() =>
            expect(createAnnouncement).toHaveBeenCalledWith('tok', {
                title: 'Aviso',
                body: 'Texto simples',
                severity: 'info',
                dismissible: true,
                ends_at: null,
            }),
        )
        expect(await screen.findByText('Comunicado publicado.')).toBeInTheDocument()
    })

    it('encerra um comunicado pelo botão', async () => {
        vi.mocked(listAdminAnnouncements).mockResolvedValue({ announcements: [announcement({})] })
        vi.mocked(endAnnouncement).mockResolvedValue({ announcement: announcement({}), outcome: 'ended', halt_lifted: false })
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Encerrar' }))
        await waitFor(() => expect(endAnnouncement).toHaveBeenCalledWith('tok', 'a1'))
        expect(await screen.findByText('Comunicado encerrado.')).toBeInTheDocument()
    })

    it('manutenção sem pausa inicia direto, sem confirmação digitada', async () => {
        vi.mocked(startMaintenance).mockResolvedValue(announcement({ kind: 'maintenance', severity: 'critical', dismissible: false }))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText('Ex: Manutenção às 22h'), { target: { value: 'Manutenção às 22h' } })
        fireEvent.change(screen.getByPlaceholderText(/volta em cerca de uma hora/), { target: { value: 'Voltamos logo.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar manutenção' }))

        await waitFor(() =>
            expect(startMaintenance).toHaveBeenCalledWith('tok', {
                title: 'Manutenção às 22h',
                body: 'Voltamos logo.',
                ends_at: null,
                pause_trading: false,
            }),
        )
    })

    it('manutenção com pausa exige digitar PAUSAR TUDO antes de enviar', async () => {
        vi.mocked(startMaintenance).mockResolvedValue(announcement({ kind: 'maintenance', linked_halt_id: 'h1' }))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText('Ex: Manutenção às 22h'), { target: { value: 'Janela' } })
        fireEvent.change(screen.getByPlaceholderText(/volta em cerca de uma hora/), { target: { value: 'Sem negociação.' } })
        fireEvent.click(screen.getByLabelText(/Pausar a negociação de todo o mercado/))
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar manutenção' }))

        const dialog = screen.getByRole('dialog', { name: 'Iniciar a manutenção e pausar o mercado?' })
        const confirm = within(dialog).getByRole('button', { name: 'Iniciar manutenção' })
        expect(confirm).toBeDisabled()
        expect(startMaintenance).not.toHaveBeenCalled()

        fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'PAUSAR TUDO' } })
        fireEvent.click(confirm)
        await waitFor(() => expect(startMaintenance).toHaveBeenCalledWith('tok', expect.objectContaining({ pause_trading: true })))
    })

    it('com manutenção em aberto mostra o resumo e "Encerrar manutenção", sem o formulário', async () => {
        vi.mocked(listAdminAnnouncements).mockResolvedValue({
            announcements: [
                announcement({ id: 'm1', kind: 'maintenance', severity: 'critical', dismissible: false, linked_halt_id: 'h1' }),
            ],
        })
        vi.mocked(endAnnouncement).mockResolvedValue({
            announcement: announcement({ id: 'm1' }),
            outcome: 'ended',
            halt_lifted: true,
        })
        renderPage()

        expect(await screen.findByText(/Manutenção em andamento/)).toBeInTheDocument()
        expect(screen.getByText(/negociação de todo o mercado está pausada/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Iniciar manutenção' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Encerrar manutenção' }))
        await waitFor(() => expect(endAnnouncement).toHaveBeenCalledWith('tok', 'm1'))
        expect(await screen.findByText('Manutenção encerrada e negociação retomada.')).toBeInTheDocument()
    })
})
