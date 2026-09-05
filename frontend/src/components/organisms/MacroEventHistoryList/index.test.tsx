import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MacroEvent } from '../../../services/admin'
import { MacroEventHistoryList } from '.'

function buildEvent(overrides: Partial<MacroEvent> = {}): MacroEvent {
    return {
        id: 'e1',
        title: 'Alta de juros afeta bancos',
        narrative: 'narrativa',
        direction: 'negativo',
        magnitude_band: 'moderado',
        affects_price: true,
        affects_fundamentals: false,
        status: 'pendente',
        triggered_on_day: 5,
        duration_days: 2,
        targets: [{ sector: 'Bancário/Financeiro' }],
        created_at: '2026-08-30T14:05:00.000Z',
        ...overrides,
    }
}

describe('MacroEventHistoryList (tela 10.1)', () => {
    it('estado vazio sem eventos disparados', () => {
        render(<MacroEventHistoryList events={[]} />)
        expect(screen.getByText('Nenhum evento macro disparado ainda.')).toBeInTheDocument()
    })

    it('mostra direção/magnitude/efeito mesmo pra evento pendente (sem gate pedagógico da 5.1)', () => {
        render(<MacroEventHistoryList events={[buildEvent({ status: 'pendente', price_effect_pct: -8 })]} />)

        fireEvent.click(screen.getByText('Alta de juros afeta bancos'))

        expect(screen.getByText('Pendente')).toBeInTheDocument()
        expect(screen.getByText('Baixa')).toBeInTheDocument()
        expect(screen.getByText('Magnitude: Moderado')).toBeInTheDocument()
        expect(screen.getByText(/Efeito de preço/)).toBeInTheDocument()
    })

    it('evento aplicado mostra o badge correspondente', () => {
        render(<MacroEventHistoryList events={[buildEvent({ status: 'aplicado' })]} />)
        expect(screen.getByText('Aplicado')).toBeInTheDocument()
    })

    it('resolve asset_id do target via assetLabels e navega ao clicar', () => {
        const onSelectAsset = vi.fn()
        render(
            <MacroEventHistoryList
                events={[buildEvent({ targets: [{ asset_id: 'a1' }] })]}
                assetLabels={{ a1: 'BNDD4 · Banco D S.A.' }}
                onSelectAsset={onSelectAsset}
            />,
        )

        fireEvent.click(screen.getByText('Alta de juros afeta bancos'))
        fireEvent.click(screen.getByText('BNDD4 · Banco D S.A.'))

        expect(onSelectAsset).toHaveBeenCalledWith('a1')
    })

    it('mostra a chave do template quando o evento veio de um template', () => {
        render(<MacroEventHistoryList events={[buildEvent({ template_key: 'alta-minerio-ferro' })]} />)
        fireEvent.click(screen.getByText('Alta de juros afeta bancos'))
        expect(screen.getByText('Template: alta-minerio-ferro')).toBeInTheDocument()
    })
})
