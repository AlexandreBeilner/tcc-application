import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssetTable } from '.'
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
})
