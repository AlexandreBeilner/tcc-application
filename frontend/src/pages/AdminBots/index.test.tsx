import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import {
    createAdminBot,
    fundAdminBot,
    getAdminBotActivity,
    getAdminBotsSummary,
    listAdminBots,
    listMarketMonitor,
    updateAdminBot,
} from '../../services/admin'
import type { AdminBot, AdminBotListing, BotActivity, BotsSummary } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminBots } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminBots: vi.fn(),
    getAdminBotActivity: vi.fn(),
    getAdminBotsSummary: vi.fn(),
    fundAdminBot: vi.fn(),
    listMarketMonitor: vi.fn(),
    createAdminBot: vi.fn(),
    updateAdminBot: vi.fn(),
}))

const bot = (overrides: Partial<AdminBot>): AdminBot => ({
    account_id: '00000000-0000-0000-0002-000000000001',
    archetype: 'chartista',
    is_active: true,
    cash: 1000,
    scope: { sectors: ['Varejo'], risk_classes: [], asset_classes: [], within_scope_pct: 0.9 },
    knowledge_level: null,
    risk_profile: { max_position_size_pct: 0.3, market_order_preference: 0.5, spread_width_pct: 0 },
    max_covered_assets: null,
    covered_assets: [],
    holdings: [],
    ...overrides,
})

const marketMaker = bot({
    account_id: '00000000-0000-0000-0001-000000000002',
    archetype: 'market_maker',
    max_covered_assets: 3,
    covered_assets: [
        { asset_id: 'a1', ticker: 'AAA3' },
        { asset_id: 'a2', ticker: 'BBB3' },
    ],
})
const chartist = bot({})
const inactive = bot({ account_id: '00000000-0000-0000-0002-000000000002', archetype: 'ruido', is_active: false })

const listing = (overrides: Partial<AdminBotListing> = {}): AdminBotListing => ({
    bots: [marketMaker, chartist, inactive],
    uncovered_assets: [{ asset_id: 'a3', ticker: 'CCC3' }],
    ...overrides,
})

// Com um bot parado o painel de saúde mostra o alerta, sem o aviso "tudo certo" (role status), que
// brigaria com o aviso de bot criado nos testes de criação.
const summary = (overrides: Partial<BotsSummary> = {}): BotsSummary => ({
    simulated_day: 20,
    idle_days: 3,
    active_bots: 2,
    idle_bots: [{ account_id: inactive.account_id, archetype: 'ruido', last_order_day: null }],
    low_cash_bots: [],
    empty_inventory: [],
    liquidity: [],
    float_concentration: [],
    ...overrides,
})

const activity = (overrides: Partial<BotActivity> = {}): BotActivity => ({
    account_id: marketMaker.account_id,
    archetype: 'market_maker',
    is_active: true,
    from_day: 1,
    to_day: 30,
    period_days: 30,
    cash: 600,
    holdings_value: 500,
    net_worth: 1100,
    capital_contributed: 1000,
    pnl: 100,
    pnl_pct: 10,
    orders: { sent: 4, filled: 1, partially_filled: 0, open: 2, cancelled: 1, cancelled_by_reason: {}, fill_rate_pct: 25 },
    trades: 1,
    volume: 500,
    last_order_at: null,
    last_order_day: null,
    quotes: [],
    ...overrides,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminBots />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAdminBots).mockResolvedValue(listing())
    vi.mocked(getAdminBotsSummary).mockResolvedValue(summary())
    vi.mocked(getAdminBotActivity).mockResolvedValue(activity())
    vi.mocked(fundAdminBot).mockResolvedValue(marketMaker)
    vi.mocked(listMarketMonitor).mockResolvedValue({ assets: [{ asset_id: 'a1', ticker: 'AAA3' }] } as Awaited<
        ReturnType<typeof listMarketMonitor>
    >)
    vi.mocked(updateAdminBot).mockResolvedValue(marketMaker)
    vi.mocked(createAdminBot).mockResolvedValue(chartist)
})

describe('AdminBots', () => {
    it('lista os bots, o resumo de ativos e o aviso dos ativos sem cobertura', async () => {
        renderPage()
        expect(await screen.findByText('2 de 3 bots ativos')).toBeInTheDocument()
        expect(rows()).toHaveLength(3)
        const warning = screen.getByRole('region', { name: 'Ativos sem cobertura' })
        expect(within(warning).getByText('1 ativo sem Market Maker ativo')).toBeInTheDocument()
        expect(within(warning).getByText('CCC3')).toBeInTheDocument()
    })

    it('sem ativo descoberto o aviso não aparece', async () => {
        vi.mocked(listAdminBots).mockResolvedValue(listing({ uncovered_assets: [] }))
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        expect(screen.queryByRole('region', { name: 'Ativos sem cobertura' })).not.toBeInTheDocument()
    })

    it('filtra por arquétipo e por status', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')

        fireEvent.click(screen.getByRole('button', { name: /Filtrar por status/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'Só inativos' }))
        expect(rows()).toHaveLength(1)
        expect(within(rows()[0]).getByText('Ruído')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Filtrar por arquétipo/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'Market Maker' }))
        expect(screen.getByText('Nenhum bot com esses filtros.')).toBeInTheDocument()
    })

    it('desativar pede confirmação, explica o efeito e manda is_active false', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const chartistRow = rows().find((row) => within(row).queryByText('Chartista'))!
        fireEvent.click(within(chartistRow).getByRole('button', { name: 'Desativar' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText(/Caixa e posições ficam como estão/)).toBeInTheDocument()
        expect(updateAdminBot).not.toHaveBeenCalled()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))
        await waitFor(() => expect(updateAdminBot).toHaveBeenCalledWith('tok', chartist.account_id, { is_active: false }))
        expect(await screen.findByRole('status')).toHaveTextContent('desativado')
    })

    it('desativar um Market Maker avisa que a cobertura deixa de valer', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const row = rows().find((r) => within(r).queryByText('Market Maker'))!
        fireEvent.click(within(row).getByRole('button', { name: 'Desativar' }))
        expect(await screen.findByText(/deixa de contar como cobertura/)).toBeInTheDocument()
    })

    it('ativar um bot inativo é direto, sem diálogo', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const row = rows().find((r) => within(r).queryByText('Ruído'))!
        fireEvent.click(within(row).getByRole('button', { name: 'Ativar' }))
        await waitFor(() => expect(updateAdminBot).toHaveBeenCalledWith('tok', inactive.account_id, { is_active: true }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('editar a cobertura: tira um ativo, adiciona um descoberto e avisa do cancelamento das ordens', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const row = rows().find((r) => within(r).queryByText('Market Maker'))!
        fireEvent.click(within(row).getByRole('button', { name: 'Cobertura' }))

        const dialog = await screen.findByRole('dialog')
        // Opções: o que ele cobre mais os sem cobertura ativa.
        expect(
            within(dialog)
                .getAllByRole('checkbox')
                .map((c) => c.closest('label')?.textContent),
        ).toEqual(['AAA3', 'BBB3', 'CCC3'])
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'BBB3' }))
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'CCC3' }))
        expect(within(dialog).getByText(/ordens em repouso deste Market Maker em BBB3 serão canceladas/)).toBeInTheDocument()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar cobertura' }))
        await waitFor(() => expect(updateAdminBot).toHaveBeenCalledWith('tok', marketMaker.account_id, { covered_asset_ids: ['a1', 'a3'] }))
        expect(await screen.findByRole('status')).toHaveTextContent('ordens do Market Maker em BBB3 foram canceladas')
    })

    it('teto abaixo da seleção mostra o erro e não envia', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const row = rows().find((r) => within(r).queryByText('Market Maker'))!
        fireEvent.click(within(row).getByRole('button', { name: 'Cobertura' }))

        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '1' } })
        expect(within(dialog).getByRole('alert')).toHaveTextContent('acima do teto')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar cobertura' }))
        expect(updateAdminBot).not.toHaveBeenCalled()
    })

    it('salvar sem mudar nada fecha o diálogo sem chamar o motor', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const row = rows().find((r) => within(r).queryByText('Market Maker'))!
        fireEvent.click(within(row).getByRole('button', { name: 'Cobertura' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Salvar cobertura' }))
        expect(updateAdminBot).not.toHaveBeenCalled()
        expect(await screen.findByRole('status')).toHaveTextContent('Nada a alterar')
    })

    it('ativo já coberto por outro Market Maker (409) mostra a mensagem e atualiza a lista', async () => {
        vi.mocked(updateAdminBot).mockRejectedValue(new ApiError(409, 'conflito'))
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const row = rows().find((r) => within(r).queryByText('Market Maker'))!
        fireEvent.click(within(row).getByRole('button', { name: 'Cobertura' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'CCC3' }))
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar cobertura' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('outro Market Maker')
        await waitFor(() => expect(listAdminBots).toHaveBeenCalledTimes(2))
    })

    it('cria um bot: converte as porcentagens e confirma na tela', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const form = screen.getByRole('form', { name: 'Novo bot' })
        fireEvent.click(within(form).getByRole('checkbox', { name: 'Varejo' }))
        fireEvent.click(within(form).getByRole('button', { name: 'Criar bot' }))

        await waitFor(() =>
            expect(createAdminBot).toHaveBeenCalledWith('tok', {
                archetype: 'ruido',
                sectors: ['Varejo'],
                risk_classes: [],
                asset_classes: [],
                within_scope_pct: 0.9,
                max_position_size_pct: 0.3,
                market_order_preference: 0.5,
                spread_width_pct: 0,
                initial_cash: 100000000,
            }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('criado. Entra na próxima rodada')
    })

    it('recusa do motor na criação aparece no formulário', async () => {
        vi.mocked(createAdminBot).mockRejectedValue(new ApiError(400, 'largura de spread acima do teto'))
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        const form = screen.getByRole('form', { name: 'Novo bot' })
        fireEvent.click(within(form).getByRole('checkbox', { name: 'Varejo' }))
        fireEvent.click(within(form).getByRole('button', { name: 'Criar bot' }))
        expect(await within(form).findByText(/O motor recusou: largura de spread acima do teto/)).toBeInTheDocument()
    })

    it('falha ao carregar mostra o erro', async () => {
        vi.mocked(listAdminBots).mockRejectedValue(new Error('rede'))
        renderPage()
        expect(await screen.findByText(/Não foi possível carregar os bots/)).toBeInTheDocument()
    })

    it('mostra os alertas de saúde e abre o desempenho do bot clicado', async () => {
        renderPage()
        const health = await screen.findByRole('region', { name: 'Saúde dos bots' })
        expect(within(health).getByText('1 bot parado')).toBeInTheDocument()

        fireEvent.click(within(health).getByRole('button', { name: 'Ruído 000002' }))
        // A tabela e os cartões do mobile renderizam o detalhe; o CSS esconde um dos dois.
        expect((await screen.findAllByRole('region', { name: 'Desempenho do bot' })).length).toBeGreaterThan(0)
        await waitFor(() => expect(getAdminBotActivity).toHaveBeenCalledWith('tok', inactive.account_id, 30))
    })

    it('Desempenho na linha abre o painel do bot, troca a janela e fecha', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')

        fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Desempenho' }))
        expect((await screen.findAllByRole('region', { name: 'Desempenho do bot' })).length).toBeGreaterThan(0)
        expect(getAdminBotActivity).toHaveBeenCalledWith('tok', marketMaker.account_id, 30)

        fireEvent.click(screen.getAllByRole('button', { name: /Janela do desempenho/ })[0])
        fireEvent.click(await screen.findByRole('option', { name: 'Últimos 7 dias' }))
        await waitFor(() => expect(getAdminBotActivity).toHaveBeenCalledWith('tok', marketMaker.account_id, 7))

        fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Ocultar desempenho' }))
        expect(screen.queryAllByRole('region', { name: 'Desempenho do bot' })).toHaveLength(0)
    })

    it('Editar abre o diálogo com a personalidade atual e envia só o que mudou', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')

        fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Editar' }))
        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByRole('checkbox', { name: 'Varejo' })).toBeChecked()
        fireEvent.change(within(dialog).getByLabelText(/Largura do spread/), { target: { value: '3' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))

        await waitFor(() => expect(updateAdminBot).toHaveBeenCalledWith('tok', chartist.account_id, { spread_width_pct: 0.03 }))
        expect(await screen.findByRole('status')).toHaveTextContent('atualizado. A mudança vale na próxima rodada')
    })

    it('Editar sem mudar nada não chama o motor', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Editar' }))
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar alterações' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Nada a alterar')
        expect(updateAdminBot).not.toHaveBeenCalled()
    })

    it('Editar com valor inválido mostra o erro e mantém o diálogo', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Editar' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Atividade dentro do escopo/), { target: { value: '50' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
        expect(await within(dialog).findByText(/Use um valor entre 85 e 90/)).toBeInTheDocument()
        expect(updateAdminBot).not.toHaveBeenCalled()
    })

    it('recusa do motor na edição aparece como erro da tela', async () => {
        vi.mocked(updateAdminBot).mockRejectedValue(new ApiError(400, 'largura de spread acima do teto'))
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Editar' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Largura do spread/), { target: { value: '4' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('O motor recusou: largura de spread acima do teto')
    })

    it('Aportar caixa e posição envia o aporte e confirma', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')

        fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Aportar' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Caixa a aportar/), { target: { value: '5000' } })
        fireEvent.click(within(dialog).getByRole('button', { name: /Ativo da posição/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'AAA3' }))
        fireEvent.change(within(dialog).getByLabelText(/Quantidade de cotas/), { target: { value: '40' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Aportar' }))

        await waitFor(() =>
            expect(fundAdminBot).toHaveBeenCalledWith('tok', marketMaker.account_id, {
                cash: 5000,
                holdings: [{ asset_id: 'a1', quantity: 40 }],
            }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('Aporte feito em Market Maker')
    })

    it('Aportar vazio mostra o erro e não chama o motor', async () => {
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Aportar' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Aportar' }))
        expect(await within(dialog).findByText(/Informe um valor em caixa e\/ou uma posição/)).toBeInTheDocument()
        expect(fundAdminBot).not.toHaveBeenCalled()
    })

    it('teto de float no aporte mostra a mensagem própria do aporte', async () => {
        vi.mocked(fundAdminBot).mockRejectedValue(new ApiError(409, 'float'))
        renderPage()
        await screen.findByText('2 de 3 bots ativos')
        fireEvent.click(within(rows()[0]).getByRole('button', { name: 'Aportar' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: /Ativo da posição/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'AAA3' }))
        fireEvent.change(within(dialog).getByLabelText(/Quantidade de cotas/), { target: { value: '10' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Aportar' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('total de cotas em circulação')
    })
})
