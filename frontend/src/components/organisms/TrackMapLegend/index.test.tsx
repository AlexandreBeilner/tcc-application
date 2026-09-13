import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrackMapLegend } from '.'

describe('TrackMapLegend', () => {
    it('não ocupa espaço fixo: legenda começa fechada, só o ícone aparece', () => {
        render(<TrackMapLegend accentColor="var(--color-track-0)" />)

        expect(screen.getByRole('button', { name: 'Como ler o mapa' })).toBeInTheDocument()
        expect(screen.queryByText('Já concluído (sólido)')).not.toBeInTheDocument()
    })

    it('clicar no ícone abre a legenda com o conteúdo dos 4 itens', () => {
        render(<TrackMapLegend accentColor="var(--color-track-0)" />)

        fireEvent.click(screen.getByRole('button', { name: 'Como ler o mapa' }))

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Já concluído (sólido)')).toBeInTheDocument()
        expect(screen.getByText('Ainda não chegou (tracejado)')).toBeInTheDocument()
        expect(screen.getByText('Linha "você está aqui"')).toBeInTheDocument()
        expect(screen.getByText('Marco que libera um produto real')).toBeInTheDocument()
    })

    it('fecha ao clicar no botão de fechar', () => {
        render(<TrackMapLegend accentColor="var(--color-track-0)" />)

        fireEvent.click(screen.getByRole('button', { name: 'Como ler o mapa' }))
        fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('fecha ao clicar no backdrop', () => {
        render(<TrackMapLegend accentColor="var(--color-track-0)" />)

        fireEvent.click(screen.getByRole('button', { name: 'Como ler o mapa' }))
        fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('fecha ao pressionar Esc', () => {
        render(<TrackMapLegend accentColor="var(--color-track-0)" />)

        fireEvent.click(screen.getByRole('button', { name: 'Como ler o mapa' }))
        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
