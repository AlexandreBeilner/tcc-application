import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../features/admin/AdminReauth'
import { useAuth } from '../../features/auth/AuthContext'
import {
    createAnnouncement,
    downloadAdminExport,
    endAnnouncement,
    getIntegrityRun,
    listAdminAnnouncements,
    startIntegrityCheck,
    startMaintenance,
} from '../../services/admin'
import type { AdminAnnouncement, IntegrityRun } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminSistema } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminAnnouncements: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    endAnnouncement: vi.fn(),
    startMaintenance: vi.fn(),
    getIntegrityRun: vi.fn(),
    startIntegrityCheck: vi.fn(),
    downloadAdminExport: vi.fn(),
}))

const announcement = (overrides: Partial<AdminAnnouncement>): AdminAnnouncement => ({
    id: 'a1',
    title: 'Evento extraordinário',
    body: 'Vamos avançar 5 dias.',
    severity: 'warning',
    kind: 'notice',
    dismissible: true,
    notify_by_email: false,
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
    vi.mocked(getIntegrityRun).mockResolvedValue(null)
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

    it('manutenção com o aviso por e-mail marcado envia notify_by_email', async () => {
        vi.mocked(startMaintenance).mockResolvedValue(announcement({ kind: 'maintenance', severity: 'critical', dismissible: false }))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText('Ex: Manutenção às 22h'), { target: { value: 'Manutenção às 22h' } })
        fireEvent.change(screen.getByPlaceholderText(/volta em cerca de uma hora/), { target: { value: 'Voltamos logo.' } })
        fireEvent.click(screen.getByLabelText(/Avisar também por e-mail quem tem o e-mail confirmado$/))
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar manutenção' }))

        await waitFor(() =>
            expect(startMaintenance).toHaveBeenCalledWith('tok', {
                title: 'Manutenção às 22h',
                body: 'Voltamos logo.',
                ends_at: null,
                pause_trading: false,
                notify_by_email: true,
            }),
        )
        expect(await screen.findByText('Manutenção iniciada. O envio por e-mail começou.')).toBeInTheDocument()
    })

    it('e-mail no comunicado só vale para crítico: a opção fica travada em "Informativo"', async () => {
        renderPage()
        const checkbox = await screen.findByLabelText(/Avisar também por e-mail quem tem o e-mail confirmado \(só comunicado crítico/)

        expect(checkbox).toBeDisabled()
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

const emptyCounts = {
    balance_mismatch: 0,
    position_mismatch: 0,
    negative_balance: 0,
    negative_position: 0,
    float_mismatch: 0,
    resting_order_unfunded: 0,
    unknown_event_type: 0,
}

const doneRun = (overrides: Partial<IntegrityRun['report'] & object> = {}): IntegrityRun => ({
    id: 'r1',
    status: 'done',
    started_at: '2026-10-06T12:00:00Z',
    finished_at: '2026-10-06T12:00:01Z',
    error: null,
    report: {
        checked: { events: 359536, accounts: 106, positions: 2125, assets: 35, resting_orders: 85 },
        total: 0,
        counts: emptyCounts,
        truncated: false,
        divergences: [],
        ...overrides,
    },
})

describe('AdminSistema, integridade financeira (N.21)', () => {
    it('sem verificação anterior avisa e oferece verificar', async () => {
        renderPage()
        expect(await screen.findByText(/Nenhuma verificação rodou/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Verificar agora' })).toBeEnabled()
    })

    it('base consistente mostra "zero divergências" e todas as categorias com zero', async () => {
        vi.mocked(getIntegrityRun).mockResolvedValue(doneRun())
        renderPage()

        expect(await screen.findByText(/Zero divergências/)).toBeInTheDocument()
        const counts = screen.getByRole('list', { name: 'Divergências por categoria' })
        expect(within(counts).getAllByRole('listitem')).toHaveLength(7)
        expect(screen.getByText(/359\.536 eventos/)).toBeInTheDocument()
        // Somente leitura: nenhuma ação de corrigir.
        expect(screen.queryByRole('button', { name: /corrigir/i })).not.toBeInTheDocument()
    })

    it('lista as divergências com esperado e encontrado, dinheiro em reais', async () => {
        vi.mocked(getIntegrityRun).mockResolvedValue(
            doneRun({
                total: 1,
                counts: { ...emptyCounts, balance_mismatch: 1 },
                divergences: [
                    {
                        kind: 'balance_mismatch',
                        user_id: 'u-123',
                        asset_id: null,
                        ticker: null,
                        order_id: null,
                        expected: '3400.00',
                        found: '3450.00',
                        detail: 'diferença de 50.00',
                    },
                ],
            }),
        )
        renderPage()

        expect(await screen.findByText('1 divergência encontrada.')).toBeInTheDocument()
        const list = screen.getByRole('list', { name: 'Divergências encontradas' })
        expect(within(list).getByText(/Conta u-123/)).toBeInTheDocument()
        expect(within(list).getByText(/Esperado: R\$\s3\.400,00\. Encontrado: R\$\s3\.450,00\./)).toBeInTheDocument()
    })

    it('lista truncada avisa que as contagens seguem exatas', async () => {
        vi.mocked(getIntegrityRun).mockResolvedValue(
            doneRun({
                total: 500,
                counts: { ...emptyCounts, balance_mismatch: 500 },
                truncated: true,
                divergences: [
                    {
                        kind: 'balance_mismatch',
                        user_id: 'u1',
                        asset_id: null,
                        ticker: null,
                        order_id: null,
                        expected: '1.00',
                        found: '2.00',
                        detail: '',
                    },
                ],
            }),
        )
        renderPage()
        expect(await screen.findByText(/aparecem as primeiras 200/)).toBeInTheDocument()
    })

    it('verificar agora abre a verificação no motor', async () => {
        vi.mocked(startIntegrityCheck).mockResolvedValue({ ...doneRun(), status: 'running', finished_at: null, report: null })
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
        await waitFor(() => expect(startIntegrityCheck).toHaveBeenCalledWith('tok'))
    })

    it('em andamento trava o botão; falha mostra o erro', async () => {
        vi.mocked(getIntegrityRun).mockResolvedValue({ ...doneRun(), status: 'running', finished_at: null, report: null })
        renderPage()
        expect(await screen.findByRole('button', { name: 'Verificando…' })).toBeDisabled()
    })

    it('verificação que falhou mostra a mensagem do motor', async () => {
        vi.mocked(getIntegrityRun).mockResolvedValue({ ...doneRun(), status: 'failed', error: 'banco fora', report: null })
        renderPage()
        expect(await screen.findByText(/A verificação falhou: banco fora/)).toBeInTheDocument()
    })

    it('409 ao iniciar mostra que já há uma em andamento', async () => {
        vi.mocked(startIntegrityCheck).mockRejectedValue(new ApiError(409, 'já existe'))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Verificar agora' }))
        expect(await screen.findByText(/Já existe uma verificação em andamento/)).toBeInTheDocument()
    })
})

describe('AdminSistema, exportação CSV (N.21)', () => {
    const file = (rows: number, truncated: boolean) => ({ blob: new Blob(['x']), filename: 'orders-20261006.csv', rows, truncated })

    beforeEach(() => {
        vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:x'), revokeObjectURL: vi.fn() })
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    })

    it('baixa o conjunto escolhido e informa quantas linhas', async () => {
        vi.mocked(downloadAdminExport).mockResolvedValue(file(3, false))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Baixar CSV' }))

        await waitFor(() => expect(downloadAdminExport).toHaveBeenCalledWith('tok', 'orders', {}))
        expect(await screen.findByText(/orders-20261006\.csv: 3 linhas\./)).toBeInTheDocument()
    })

    it('arquivo cortado pelo teto avisa que há mais linhas', async () => {
        vi.mocked(downloadAdminExport).mockResolvedValue(file(50000, true))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Baixar CSV' }))
        expect(await screen.findByText(/cortado no limite/)).toBeInTheDocument()
    })

    it('envia período e limite; período invertido nem chama o servidor', async () => {
        vi.mocked(downloadAdminExport).mockResolvedValue(file(1, false))
        renderPage()
        const [from, to] = Array.from(document.querySelectorAll('input[type="datetime-local"]')).slice(-2) as HTMLInputElement[]
        fireEvent.change(from, { target: { value: '2026-10-02T10:00' } })
        fireEvent.change(to, { target: { value: '2026-10-01T10:00' } })
        fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
        expect(await screen.findByText(/não pode ser depois do fim/)).toBeInTheDocument()
        expect(downloadAdminExport).not.toHaveBeenCalled()

        fireEvent.change(from, { target: { value: '2026-10-01T08:00' } })
        fireEvent.change(screen.getByPlaceholderText('10.000'), { target: { value: '25' } })
        fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
        await waitFor(() =>
            expect(downloadAdminExport).toHaveBeenCalledWith('tok', 'orders', {
                from: new Date('2026-10-01T08:00').toISOString(),
                to: new Date('2026-10-01T10:00').toISOString(),
                limit: 25,
            }),
        )
    })

    it('usuários: a dica avisa que traz dado pessoal e pede senha', async () => {
        renderPage()
        await screen.findByRole('button', { name: 'Baixar CSV' })
        fireEvent.click(screen.getByRole('button', { name: 'Conjunto de dados' }))
        fireEvent.click(await screen.findByRole('option', { name: 'Usuários' }))
        expect(screen.getByText(/Contém dado pessoal e pede sua senha/)).toBeInTheDocument()
    })

    it('erro do servidor aparece na tela', async () => {
        vi.mocked(downloadAdminExport).mockRejectedValue(new ApiError(400, 'x'))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Baixar CSV' }))
        expect(await screen.findByText(/recusou o filtro/)).toBeInTheDocument()
    })
})
