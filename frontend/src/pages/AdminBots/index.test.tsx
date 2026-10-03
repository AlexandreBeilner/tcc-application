import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { createAdminBot, listAdminBots, updateAdminBot } from '../../services/admin'
import type { AdminBot, AdminBotListing } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminBots } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminBots: vi.fn(),
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
})
