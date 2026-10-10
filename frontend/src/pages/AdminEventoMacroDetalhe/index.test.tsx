import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { cancelMacroEvent, getMacroEventDetail } from '../../services/admin'
import type { MacroEventDetail } from '../../services/admin'
import { listAssets } from '../../services/market'
import { ApiError } from '../../services/client'
import { AdminEventoMacroDetalhe } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getMacroEventDetail: vi.fn(), cancelMacroEvent: vi.fn() }))
vi.mock('../../services/market', () => ({ listAssets: vi.fn() }))

function detail(overrides: Partial<MacroEventDetail> = {}): MacroEventDetail {
    return {
        id: 'e1',
        title: 'Minério dispara',
        narrative: 'Narrativa do evento',
        direction: 'positivo',
        magnitude_band: 'moderado',
        affects_price: true,
        affects_fundamentals: true,
        status: 'pendente',
        triggered_on_day: 130,
        duration_days: 2,
        price_effect_pct: 9.5,
        fundamentals_effect_pct: 12,
        fundamentals_report_day: 182,
        targets: [{ sector: 'Mineração' }],
        scheduled: true,
        cancellable: true,
        created_at: '2026-10-03T12:00:00.000Z',
        created_by: 'admin-1',
        current_day: 100,
        report_date: '2027-03-01',
        publicly_visible: false,
        impact: { available: false, window_days: 5, base_day: 129, end_day: 134, available_on_day: 134, targets: [] },
        user_view: {
            id: 'e1',
            title: 'Minério dispara',
            narrative: 'Narrativa do evento',
            direction: '',
            magnitude_band: '',
            affects_price: true,
            affects_fundamentals: true,
            status: 'pendente',
            triggered_on_day: 130,
            duration_days: 2,
            targets: [],
        },
        ...overrides,
    }
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/admin/eventos/:id', element: <AdminEventoMacroDetalhe /> },
            { path: '/admin/eventos', element: <div>histórico</div> },
        ],
        { initialEntries: ['/admin/eventos/e1'] },
    )
    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAssets).mockResolvedValue({ assets: [] })
})

describe('AdminEventoMacroDetalhe (tela 10.12)', () => {
    it('evento agendado: mostra o ciclo de vida, o relatório e que o jogador ainda não vê nada', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail())
        renderPage()

        expect(await screen.findByRole('heading', { name: 'Minério dispara' })).toBeInTheDocument()
        const lifecycle = screen.getByRole('region', { name: 'Ciclo de vida' })
        expect(within(lifecycle).getByText('Efeito começa no dia')).toBeInTheDocument()
        expect(within(lifecycle).getByText('182 (2027-03-01)')).toBeInTheDocument()
        expect(within(lifecycle).getByText('Ainda não (aparece na véspera)')).toBeInTheDocument()
        expect(screen.getByText('Nada ainda: o evento não está no feed dos jogadores.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancelar evento' })).toBeEnabled()
        expect(screen.getByText(/Disponível quando o mercado chegar ao dia 134/)).toBeInTheDocument()
    })

    it('diz quando o jogador passa a ver o evento, pela antecedência escolhida (N.25)', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail({ reveal_lead_days: 7 }))
        renderPage()
        expect(await screen.findByText('Ainda não (aparece 7 dias antes do efeito)')).toBeInTheDocument()
    })

    it('antecedência 0: o jogador só vê quando o efeito começar (N.25)', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail({ reveal_lead_days: 0 }))
        renderPage()
        expect(await screen.findByText('Ainda não (aparece quando o efeito começar)')).toBeInTheDocument()
    })

    it('evento visível e pendente: a versão do jogador não revela direção nem alvos', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail({ scheduled: false, publicly_visible: true }))
        renderPage()
        expect(await screen.findByText(/o jogador não vê a direção, a magnitude, os efeitos nem os alvos/)).toBeInTheDocument()
    })

    it('cancelar desabilitado com a razão quando o efeito já começou ou o evento já foi aplicado', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail({ scheduled: false, cancellable: false }))
        renderPage()
        expect(await screen.findByText('O efeito já começou: não dá mais pra cancelar.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancelar evento' })).toBeDisabled()
    })

    it('impacto disponível lista a variação por alvo e por ativo', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(
            detail({
                status: 'aplicado',
                scheduled: false,
                cancellable: false,
                publicly_visible: true,
                impact: {
                    available: true,
                    window_days: 5,
                    base_day: 129,
                    end_day: 134,
                    available_on_day: 134,
                    targets: [
                        {
                            sector: 'Mineração',
                            average_change_pct: 7.5,
                            assets: [{ asset_id: 'a1', ticker: 'ACME3', price_before: 10, price_after: 10.75, change_pct: 7.5 }],
                        },
                    ],
                },
            }),
        )
        renderPage()
        const impact = await screen.findByRole('region', { name: 'Impacto realizado' })
        expect(within(impact).getByText('Setor: Mineração')).toBeInTheDocument()
        expect(within(impact).getByText('ACME3')).toBeInTheDocument()
        expect(within(impact).getByText(/Média/)).toBeInTheDocument()
    })

    it('trocar a janela refaz a consulta com o novo valor', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail())
        renderPage()
        await screen.findByRole('heading', { name: 'Minério dispara' })
        fireEvent.change(screen.getByLabelText('Janela do impacto'), { target: { value: '10' } })
        await waitFor(() => expect(getMacroEventDetail).toHaveBeenCalledWith('tok', 'e1', 10))
    })

    it('cancelar pede confirmação e envia o DELETE', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail())
        vi.mocked(cancelMacroEvent).mockResolvedValue({ event: detail() })
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Cancelar evento' }))
        expect(screen.getByText(/Não dá pra desfazer/)).toBeInTheDocument()
        expect(cancelMacroEvent).not.toHaveBeenCalled()
        const dialog = screen.getByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar evento' }))
        await waitFor(() => expect(cancelMacroEvent).toHaveBeenCalledWith('tok', 'e1'))
        expect(await screen.findByRole('status')).toHaveTextContent('Evento cancelado')
    })

    it('mostra o motivo do motor quando recusa o cancelamento', async () => {
        vi.mocked(getMacroEventDetail).mockResolvedValue(detail())
        vi.mocked(cancelMacroEvent).mockRejectedValue(new ApiError(409, 'já existe um tick em andamento; tente de novo em instantes'))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Cancelar evento' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar evento' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('já existe um tick em andamento')
    })

    it('evento inexistente mostra a mensagem e o caminho de volta', async () => {
        vi.mocked(getMacroEventDetail).mockRejectedValue(new ApiError(404, 'não encontrado'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Esse evento não existe.')
        expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toBeInTheDocument()
    })
})
