import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NewsEvent } from '../../../services/news'
import { NewsEventList } from '.'

function event(overrides: Partial<NewsEvent> = {}): NewsEvent {
    return {
        id: 'event-1',
        title: 'Alta de juros afeta bancos',
        narrative: 'O Copom subiu a taxa básica, pressionando o setor financeiro.',
        direction: 'negativo',
        magnitude_band: 'moderado',
        affects_price: true,
        affects_fundamentals: false,
        status: 'pendente',
        triggered_on_day: 5,
        duration_days: 2,
        price_effect_pct: -8.4,
        targets: [{ sector: 'Financeiro' }],
        created_at: '2026-08-30T14:05:00.000Z',
        ...overrides,
    }
}

describe('NewsEventList', () => {
    it('mostra estado vazio sem eventos', () => {
        render(<NewsEventList events={[]} />)
        expect(screen.getByText('Nenhum evento de mercado disparado ainda.')).toBeInTheDocument()
    })

    it('mostra título e status na linha fechada', () => {
        render(<NewsEventList events={[event()]} />)
        expect(screen.getByText('Alta de juros afeta bancos')).toBeInTheDocument()
        expect(screen.getByText('Pendente')).toBeInTheDocument()
    })

    it('mostra a data real de criação (created_at), formatada igual ao Extrato', () => {
        render(<NewsEventList events={[event({ created_at: '2026-08-30T14:05:00.000Z' })]} />)
        const expected = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date('2026-08-30T14:05:00.000Z'))
        expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it('diferencia pendente de aplicado', () => {
        render(<NewsEventList events={[event({ id: 'e1', status: 'pendente' }), event({ id: 'e2', status: 'aplicado' })]} />)
        expect(screen.getByText('Pendente')).toBeInTheDocument()
        expect(screen.getByText('Aplicado')).toBeInTheDocument()
    })

    it('expandir mostra a narrativa completa e o efeito de preço', () => {
        render(<NewsEventList events={[event()]} />)
        const summary = screen.getByText('Alta de juros afeta bancos')
        fireEvent.click(summary)
        expect(screen.getByText(/Copom subiu a taxa básica/)).toBeInTheDocument()
        expect(screen.getByText(/−8,4%/)).toBeInTheDocument()
    })

    it('resolve target de setor como texto, sem navegação', () => {
        render(<NewsEventList events={[event()]} />)
        fireEvent.click(screen.getByText('Alta de juros afeta bancos'))
        expect(screen.getByText('Setor: Financeiro')).toBeInTheDocument()
    })

    it('target com asset_id vira botão clicável que chama onSelectAsset', () => {
        const onSelectAsset = vi.fn()
        render(
            <NewsEventList
                events={[event({ targets: [{ asset_id: 'asset-1' }] })]}
                assetLabels={{ 'asset-1': 'BNDD4 · Banco D S.A.' }}
                onSelectAsset={onSelectAsset}
            />,
        )
        fireEvent.click(screen.getByText('Alta de juros afeta bancos'))
        fireEvent.click(screen.getByText('BNDD4 · Banco D S.A.'))
        expect(onSelectAsset).toHaveBeenCalledWith('asset-1')
    })

    it('chama onEventRead na primeira expansão do evento', async () => {
        const onEventRead = vi.fn()
        render(<NewsEventList events={[event()]} onEventRead={onEventRead} />)
        fireEvent.click(screen.getByText('Alta de juros afeta bancos'))
        await waitFor(() => expect(onEventRead).toHaveBeenCalledTimes(1))
    })

    it('não chama onEventRead quando o <details> fecha', () => {
        const onEventRead = vi.fn()
        const { container } = render(<NewsEventList events={[event()]} onEventRead={onEventRead} />)
        const details = container.querySelector('details') as HTMLDetailsElement

        details.open = false
        fireEvent(details, new Event('toggle'))

        expect(onEventRead).not.toHaveBeenCalled()
    })
})
