import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../services/client'
import type { NewCatalogAssetPreview } from '../../../services/admin'
import { NewAssetForm } from '.'

const preview: NewCatalogAssetPreview = {
    kind: 'acao',
    ticker: 'NOVA3',
    name: 'Nova ON',
    outstanding_shares: 200_000_000,
    pool: {
        pool_before: 60,
        pool_after: 62,
        new_bots: 2,
        market_maker_shares: 100_000_000,
        bot_shares: 100_000_000,
        market_maker_id: 'mm-1',
        creates_market_maker: false,
    },
}

// O rótulo do ticker principal inclui a dica ("TickerAção ON termina em 3."); os das linhas da cesta começam com "Ticker do".
const MAIN_TICKER = /^Ticker(Ação|FII)/

function setup(overrides: Partial<Parameters<typeof NewAssetForm>[0]> = {}) {
    const props = {
        onPreview: vi.fn().mockResolvedValue(preview),
        onCreate: vi.fn().mockResolvedValue({ asset_id: 'a1', preview }),
        onCreated: vi.fn(),
        onCancel: vi.fn(),
        ...overrides,
    }
    render(<NewAssetForm {...props} />)
    return props
}

function fillEquity() {
    fireEvent.change(screen.getByLabelText(MAIN_TICKER), { target: { value: 'nova3' } })
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Nova ON' } })
    fireEvent.change(screen.getByLabelText(/^Empresa emissora/), { target: { value: 'Nova S.A.' } })
    fireEvent.change(screen.getByLabelText(/^CNPJ/), { target: { value: '44.555.666/0001-77' } })
    fireEvent.change(screen.getByLabelText(/^Ações em circulação/), { target: { value: '200000000' } })
}

describe('NewAssetForm', () => {
    it('erro de digitação é recusado na tela, sem chamar o motor', () => {
        const props = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Ver o que será criado' }))
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
        expect(props.onPreview).not.toHaveBeenCalled()
    })

    it('mostra o preview e só cadastra depois de digitar o ticker', async () => {
        const props = setup()
        fillEquity()
        fireEvent.click(screen.getByRole('button', { name: 'Ver o que será criado' }))

        const section = await screen.findByRole('region', { name: 'O que será criado' })
        expect(section).toHaveTextContent('60 para 62 (2 novos')
        expect(section).toHaveTextContent('Nenhuma posição de ativo existente muda.')
        expect(props.onPreview).toHaveBeenCalledWith(expect.objectContaining({ kind: 'acao', ticker: 'NOVA3', cnpj: '44555666000177' }))
        expect(props.onCreate).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Cadastrar ativo' }))
        const confirm = screen.getByRole('button', { name: 'Cadastrar' })
        expect(confirm).toBeDisabled()
        fireEvent.change(screen.getByLabelText(/Para confirmar/), { target: { value: 'NOVA3' } })
        fireEvent.click(confirm)

        await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith({ asset_id: 'a1', preview }))
        expect(props.onCreate).toHaveBeenCalledTimes(1)
    })

    it('mudar um campo depois do preview invalida o preview', async () => {
        setup()
        fillEquity()
        fireEvent.click(screen.getByRole('button', { name: 'Ver o que será criado' }))
        await screen.findByRole('region', { name: 'O que será criado' })
        fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Outro nome' } })
        expect(screen.queryByRole('region', { name: 'O que será criado' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ver o que será criado' })).toBeInTheDocument()
    })

    it('mostra a recusa do motor no campo apontado', async () => {
        setup({ onPreview: vi.fn().mockRejectedValue(new ApiError(409, 'o ticker NOVA3 já existe no catálogo')) })
        fillEquity()
        fireEvent.click(screen.getByRole('button', { name: 'Ver o que será criado' }))
        expect(await screen.findByText('o ticker NOVA3 já existe no catálogo')).toBeInTheDocument()
    })

    it('falha depois do catálogo avisa que o ativo foi criado', async () => {
        setup({ onCreate: vi.fn().mockRejectedValue(new ApiError(500, 'cobertura falhou', { asset_id: 'a1' })) })
        fillEquity()
        fireEvent.click(screen.getByRole('button', { name: 'Ver o que será criado' }))
        await screen.findByRole('region', { name: 'O que será criado' })
        fireEvent.click(screen.getByRole('button', { name: 'Cadastrar ativo' }))
        fireEvent.change(screen.getByLabelText(/Para confirmar/), { target: { value: 'NOVA3' } })
        fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
        expect(await screen.findByText(/O ativo foi criado/)).toBeInTheDocument()
    })

    it('ETF: cesta editável, soma dos pesos e preview sem float de bots', async () => {
        const etfPreview = { ...preview, kind: 'etf', ticker: 'NOVE11', outstanding_shares: null, pool: null }
        const props = setup({ onPreview: vi.fn().mockResolvedValue(etfPreview) })
        fireEvent.click(screen.getByRole('button', { name: 'Classe do ativo novo' }))
        fireEvent.click(screen.getByRole('option', { name: 'ETF' }))

        fireEvent.change(screen.getByLabelText(MAIN_TICKER), { target: { value: 'NOVE11' } })
        fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'ETF Novo' } })
        fireEvent.change(screen.getByLabelText(/^Índice de referência/), { target: { value: 'Idx' } })
        fireEvent.change(screen.getByLabelText('Ticker do constituinte 1'), { target: { value: 'VALR3' } })
        fireEvent.change(screen.getByLabelText('Peso do constituinte 1 (%)'), { target: { value: '60' } })
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar constituinte' }))
        fireEvent.change(screen.getByLabelText('Ticker do constituinte 2'), { target: { value: 'TJLO11' } })
        fireEvent.change(screen.getByLabelText('Peso do constituinte 2 (%)'), { target: { value: '40' } })
        expect(screen.getByText('Soma dos pesos: 100%')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Ver o que será criado' }))
        expect(await screen.findByText(/O ETF nasce sem cotas/)).toBeInTheDocument()
        expect(props.onPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'etf',
                holdings: [
                    { ticker: 'VALR3', weight_pct: 60 },
                    { ticker: 'TJLO11', weight_pct: 40 },
                ],
            }),
        )
    })

    it('cancelar chama onCancel', () => {
        const props = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(props.onCancel).toHaveBeenCalled()
    })
})
