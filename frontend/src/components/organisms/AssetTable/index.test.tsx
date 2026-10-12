import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssetTable, AssetTableSkeleton } from '.'
import type { AssetSummary } from '../../../services/market'

const assets: AssetSummary[] = [
    { id: 'a1', ticker: 'CDB2027', name: 'CDB Banco X', type: 'cdb', is_sandbox: false },
    { id: 'a2', ticker: 'LCI2026', name: 'LCI Banco Y', type: 'lci', is_sandbox: false },
]

const columns = [
    { key: 'ticker', header: 'Ticker', render: (asset: AssetSummary) => asset.ticker },
    { key: 'name', header: 'Nome', render: (asset: AssetSummary) => asset.name },
]

describe('AssetTable', () => {
    it('mostra a mensagem vazia quando não há ativos', () => {
        render(<AssetTable assets={[]} columns={columns} onSelect={vi.fn()} emptyMessage="Nenhum produto disponível." />)
        expect(screen.getByText('Nenhum produto disponível.')).toBeInTheDocument()
    })

    it('renderiza uma linha/card por ativo com as colunas informadas', () => {
        render(<AssetTable assets={assets} columns={columns} onSelect={vi.fn()} emptyMessage="vazio" />)
        expect(screen.getAllByText('CDB2027').length).toBeGreaterThan(0)
        expect(screen.getAllByText('LCI2026').length).toBeGreaterThan(0)
    })

    it('clique num ativo chama onSelect com o ativo certo', () => {
        const onSelect = vi.fn()
        render(<AssetTable assets={assets} columns={columns} onSelect={onSelect} emptyMessage="vazio" />)
        fireEvent.click(screen.getAllByText('CDB2027')[0])
        expect(onSelect).toHaveBeenCalledWith(assets[0])
    })

    it('Enter na linha da tabela seleciona o ativo (teclado)', () => {
        const onSelect = vi.fn()
        const { container } = render(<AssetTable assets={assets} columns={columns} onSelect={onSelect} emptyMessage="vazio" />)
        const row = container.querySelector('tbody tr') as HTMLElement
        fireEvent.keyDown(row, { key: 'Enter' })
        expect(onSelect).toHaveBeenCalledWith(assets[0])
    })

    it('cartão usa os papéis (slots): título, subtítulo, etiqueta, preço e variação', () => {
        const slotted = [
            { key: 'ticker', header: 'Ticker', render: (a: AssetSummary) => a.ticker, slot: 'title' as const },
            { key: 'name', header: 'Nome', render: (a: AssetSummary) => a.name, slot: 'subtitle' as const },
            { key: 'type', header: 'Tipo', render: () => 'CDB', slot: 'tag' as const },
            { key: 'price', header: 'Preço', render: () => 'R$ 10,00', slot: 'price' as const, align: 'end' as const },
        ]
        const { container } = render(<AssetTable assets={assets} columns={slotted} onSelect={vi.fn()} emptyMessage="vazio" />)
        const card = container.querySelector('ul button') as HTMLElement
        expect(card).toHaveTextContent('CDB2027')
        expect(card).toHaveTextContent('CDB Banco X')
        expect(card).toHaveTextContent('CDB')
        expect(card).toHaveTextContent('R$ 10,00')
    })

    it('com `sparklines` mostra a coluna e o gráfico só de quem tem série', () => {
        const { container } = render(
            <AssetTable assets={assets} columns={columns} onSelect={vi.fn()} emptyMessage="vazio" sparklines={{ a1: [1, 2, 3] }} />,
        )
        expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument()
        // tabela (1 com série) + cartões (1 com série)
        expect(container.querySelectorAll('svg')).toHaveLength(2)
    })

    it('sem `sparklines` não há coluna de gráfico', () => {
        render(<AssetTable assets={assets} columns={columns} onSelect={vi.fn()} emptyMessage="vazio" />)
        expect(screen.queryByText('Últimos 30 dias')).toBeNull()
    })
})

describe('AssetTableSkeleton', () => {
    it('anuncia o carregamento só para leitor de tela', () => {
        render(<AssetTableSkeleton label="Carregando produtos…" />)
        expect(screen.getByRole('status')).toHaveTextContent('Carregando produtos…')
    })
})
