import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompanyAssetList } from '.'

describe('CompanyAssetList', () => {
    it('mostra estado vazio sem nenhum ativo emitido', () => {
        render(<CompanyAssetList assets={[]} onSelect={vi.fn()} />)
        expect(screen.getByText('Nenhum ativo emitido por esta empresa ainda.')).toBeInTheDocument()
    })

    it('clique num ativo chama onSelect com o ativo certo', () => {
        const onSelect = vi.fn()
        const asset = { id: 'a1', ticker: 'PETR4', name: 'Petrobras', share_class: 'PN' }
        render(<CompanyAssetList assets={[asset]} onSelect={onSelect} />)
        fireEvent.click(screen.getByText('PETR4'))
        expect(onSelect).toHaveBeenCalledWith(asset)
    })
})
