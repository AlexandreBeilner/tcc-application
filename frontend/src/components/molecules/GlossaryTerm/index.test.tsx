import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GlossaryTerm } from '.'

describe('GlossaryTerm', () => {
    it('mostra o termo com sublinhado tracejado, popover fechado por padrão', () => {
        render(<GlossaryTerm term="FGC" definition="Fundo Garantidor de Créditos." />)

        expect(screen.getByRole('button', { name: 'FGC' })).toBeInTheDocument()
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('clique no termo abre o popover com a definição', () => {
        render(<GlossaryTerm term="FGC" definition="Fundo Garantidor de Créditos." />)

        fireEvent.click(screen.getByRole('button', { name: 'FGC' }))

        expect(screen.getByRole('tooltip')).toHaveTextContent('Fundo Garantidor de Créditos.')
    })

    it('hover no termo abre o popover, mouse saindo fecha', () => {
        render(<GlossaryTerm term="FGC" definition="Fundo Garantidor de Créditos." />)
        const trigger = screen.getByRole('button', { name: 'FGC' })

        fireEvent.mouseEnter(trigger)
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        fireEvent.mouseLeave(trigger)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('Enter no termo focado abre o popover, Escape fecha e devolve o foco', () => {
        render(<GlossaryTerm term="FGC" definition="Fundo Garantidor de Créditos." />)
        const trigger = screen.getByRole('button', { name: 'FGC' })
        trigger.focus()

        fireEvent.keyDown(trigger, { key: 'Enter' })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        fireEvent.keyDown(trigger, { key: 'Escape' })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
    })

    it('clique fora do termo fecha o popover', () => {
        render(
            <div>
                <GlossaryTerm term="FGC" definition="Fundo Garantidor de Créditos." />
                <button type="button">fora</button>
            </div>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'FGC' }))
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        fireEvent.pointerDown(screen.getByRole('button', { name: 'fora' }))
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
})
