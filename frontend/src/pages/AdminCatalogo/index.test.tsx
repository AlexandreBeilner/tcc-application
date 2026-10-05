import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAdminCatalog, updateCatalogAsset } from '../../services/admin'
import type { CatalogAsset } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminCatalogo } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminCatalog: vi.fn(),
    updateCatalogAsset: vi.fn(),
}))

const base: CatalogAsset = {
    asset_id: 'a1',
    ticker: 'ACME3',
    name: 'Acme',
    type: 'acao',
    risk_class: null,
    is_sandbox: false,
    share_class: 'ON',
    outstanding_shares: 1000,
    editable: ['name', 'base_growth_pct', 'quality_multiplier'],
    company: { company_id: 'c1', name: 'Acme SA', sector: 'Varejo', report_frequency_days: 91, base_growth_pct: 3, quality_multiplier: 1 },
    etf: null,
    fii: null,
    fixed_income: null,
}
const etf: CatalogAsset = {
    ...base,
    asset_id: 'e1',
    ticker: 'ETFX11',
    name: 'ETF X',
    type: 'etf',
    share_class: null,
    editable: ['name', 'methodology_summary'],
    company: null,
    etf: {
        benchmark_index: 'IBOV',
        methodology_summary: 'Replica o índice.',
        expense_ratio_pct: 0.5,
        rebalance_frequency_days: 14,
        holdings: [{ name: 'Acme', weight_pct: 60 }],
        holdings_total_weight_pct: 60,
    },
}
const sandbox: CatalogAsset = { ...base, asset_id: 's1', ticker: 'SBX3', name: 'Ativo fictício', is_sandbox: true, editable: [] }
const cdb: CatalogAsset = {
    ...base,
    asset_id: 'r1',
    ticker: 'CDB1',
    name: 'CDB Um',
    type: 'cdb',
    share_class: null,
    outstanding_shares: null,
    editable: ['name'],
    company: null,
    fixed_income: {
        interest_rate: 11,
        maturity_date: '2030-01-01',
        issuer_type: 'banco',
        tax_exempt: false,
        credit_risk_rating: null,
        minimum_investment: 1000,
    },
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminCatalogo />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const card = (name: string) => screen.findByRole('article', { name })

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAdminCatalog).mockResolvedValue([base, etf, sandbox, cdb])
})

describe('AdminCatalogo', () => {
    it('mostra o bloco da classe de cada ativo, sem misturar indicadores', async () => {
        renderPage()
        const acao = within(await card('ACME3'))
        expect(acao.getByText('3% por ciclo')).toBeInTheDocument()
        expect(acao.getByText('Varejo')).toBeInTheDocument()
        expect(acao.getByText('91 dias')).toBeInTheDocument()
        const fundo = within(await card('ETFX11'))
        expect(fundo.getByText('IBOV')).toBeInTheDocument()
        expect(fundo.queryByText('Setor')).not.toBeInTheDocument()
        expect(within(await card('CDB1')).getByText('Aplicação mínima')).toBeInTheDocument()
    })

    it('sandbox aparece marcado e sem botão de editar', async () => {
        renderPage()
        const sbx = within(await card('SBX3'))
        expect(sbx.getByText('Sandbox')).toBeInTheDocument()
        expect(sbx.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    })

    it('filtra por classe e por busca', async () => {
        renderPage()
        await card('ACME3')
        fireEvent.change(screen.getByPlaceholderText('Ticker ou nome'), { target: { value: 'etf' } })
        expect(screen.queryByRole('article', { name: 'ACME3' })).not.toBeInTheDocument()
        expect(screen.getByRole('article', { name: 'ETFX11' })).toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText('Ticker ou nome'), { target: { value: 'zzz' } })
        expect(screen.getByText('Nenhum ativo com esses filtros.')).toBeInTheDocument()
    })

    it('edita, confirma com o de/para e grava só o que mudou', async () => {
        vi.mocked(updateCatalogAsset).mockResolvedValue({ ...base, name: 'Acme Brasil' })
        renderPage()
        const acao = within(await card('ACME3'))
        fireEvent.click(acao.getByRole('button', { name: 'Editar ACME3' }))
        fireEvent.change(acao.getByLabelText(/Nome/), { target: { value: 'Acme Brasil' } })
        fireEvent.change(acao.getByLabelText(/Multiplicador de qualidade/), { target: { value: '1,4' } })
        fireEvent.click(acao.getByRole('button', { name: 'Salvar' }))

        expect(screen.getByText('Nome: "Acme" para "Acme Brasil"')).toBeInTheDocument()
        expect(screen.getByText('Multiplicador de qualidade: 1 para 1,4')).toBeInTheDocument()
        expect(updateCatalogAsset).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))

        await waitFor(() => expect(updateCatalogAsset).toHaveBeenCalledWith('tok', 'a1', { name: 'Acme Brasil', quality_multiplier: 1.4 }))
        expect(await screen.findByRole('status')).toHaveTextContent('ACME3 atualizado')
    })

    it('valor inválido é recusado na tela, sem chamar a rede', async () => {
        renderPage()
        const acao = within(await card('ACME3'))
        fireEvent.click(acao.getByRole('button', { name: 'Editar ACME3' }))
        fireEvent.change(acao.getByLabelText(/Multiplicador de qualidade/), { target: { value: '3' } })
        fireEvent.click(acao.getByRole('button', { name: 'Salvar' }))
        expect(acao.getByRole('alert')).toHaveTextContent('até 2')
        expect(updateCatalogAsset).not.toHaveBeenCalled()
    })

    it('mostra a mensagem do motor quando ele recusa', async () => {
        vi.mocked(updateCatalogAsset).mockRejectedValue(new ApiError(422, 'ativo do sandbox não é editável'))
        renderPage()
        const acao = within(await card('ACME3'))
        fireEvent.click(acao.getByRole('button', { name: 'Editar ACME3' }))
        fireEvent.change(acao.getByLabelText(/Nome/), { target: { value: 'Outro' } })
        fireEvent.click(acao.getByRole('button', { name: 'Salvar' }))
        fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('O motor recusou a alteração: ativo do sandbox não é editável')
    })

    it('ETF edita a metodologia e CDB só o nome', async () => {
        renderPage()
        const fundo = within(await card('ETFX11'))
        fireEvent.click(fundo.getByRole('button', { name: 'Editar ETFX11' }))
        expect(fundo.getByLabelText(/Metodologia/)).toBeInTheDocument()
        expect(fundo.queryByLabelText(/Crescimento/)).not.toBeInTheDocument()
        const rf = within(await card('CDB1'))
        fireEvent.click(rf.getByRole('button', { name: 'Editar CDB1' }))
        expect(rf.getByLabelText(/Nome/)).toBeInTheDocument()
        expect(rf.queryByLabelText(/Metodologia/)).not.toBeInTheDocument()
    })

    it('avisa quando não consegue carregar', async () => {
        vi.mocked(listAdminCatalog).mockRejectedValue(new Error('boom'))
        renderPage()
        expect(await screen.findByText(/Não foi possível carregar o catálogo/)).toBeInTheDocument()
    })
})
