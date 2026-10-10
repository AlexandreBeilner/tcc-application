import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LessonWidget, widgetRegistry } from '.'
import { WIDGET_IDS } from '../../../features/lessons/widgets/schema'
import type { WidgetBlock } from '../../../features/lessons/widgets/schema'

function block(overrides: Partial<WidgetBlock>): WidgetBlock {
    return { type: 'widget', id: 'w1', widget: 'callout', props: { title: 'Dica', body: 'Corpo da dica' }, ...overrides }
}

describe('LessonWidget', () => {
    afterEach(() => vi.restoreAllMocks())

    it('todo widget do contrato tem entrada no registro com resumo textual', () => {
        for (const id of WIDGET_IDS) {
            expect(widgetRegistry[id], id).toBeDefined()
        }
    })

    it('renderiza o widget pelo registro, com resumo no grupo e legenda', () => {
        render(<LessonWidget block={block({ caption: 'Veja a dica' })} />)

        expect(screen.getByRole('group', { name: 'Dica. Corpo da dica' })).toBeInTheDocument()
        expect(screen.getByText('Corpo da dica')).toBeInTheDocument()
        expect(screen.getByText('Veja a dica')).toBeInTheDocument()
    })

    it('props inválidas viram fallback (legenda), sem renderizar o widget', () => {
        render(<LessonWidget block={block({ props: { title: '' }, caption: 'Texto de reserva' })} />)

        expect(screen.getByText('Texto de reserva')).toBeInTheDocument()
        expect(screen.queryByRole('group')).not.toBeInTheDocument()
    })

    it('widget desconhecido vira aviso discreto', () => {
        render(<LessonWidget block={block({ widget: 'nao-existe', props: {} })} />)

        expect(screen.getByText('Este conteúdo interativo não está disponível agora.')).toBeInTheDocument()
    })

    it('widget que quebra no render mostra o fallback e não derruba quem está em volta', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const original = widgetRegistry.callout.component
        widgetRegistry.callout.component = () => {
            throw new Error('quebrou')
        }

        try {
            render(
                <div>
                    <p>resto da lição</p>
                    <LessonWidget block={block({ caption: 'reserva' })} />
                </div>,
            )

            expect(screen.getAllByText('reserva').length).toBeGreaterThan(0)
            expect(screen.getByText('resto da lição')).toBeInTheDocument()
        } finally {
            widgetRegistry.callout.component = original
        }
    })
})
