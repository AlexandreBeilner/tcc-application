import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WidgetBoundary } from '.'

function Boom(): never {
    throw new Error('quebrou')
}

describe('WidgetBoundary', () => {
    afterEach(() => vi.restoreAllMocks())

    it('renderiza os filhos quando nada falha', () => {
        render(
            <WidgetBoundary fallback={<p>fallback</p>}>
                <p>conteúdo</p>
            </WidgetBoundary>,
        )

        expect(screen.getByText('conteúdo')).toBeInTheDocument()
    })

    it('erro no render do widget mostra o fallback e não propaga', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})

        render(
            <div>
                <p>resto da lição</p>
                <WidgetBoundary fallback={<p>fallback</p>}>
                    <Boom />
                </WidgetBoundary>
            </div>,
        )

        expect(screen.getByText('fallback')).toBeInTheDocument()
        expect(screen.getByText('resto da lição')).toBeInTheDocument()
    })
})
