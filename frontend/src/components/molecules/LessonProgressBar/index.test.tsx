import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonProgressBar } from '.'

describe('LessonProgressBar', () => {
    it('anuncia "Cartão X de Y" como barra de progresso', () => {
        render(<LessonProgressBar current={7} total={15} markers={[]} />)

        const bar = screen.getByRole('progressbar', { name: 'Progresso da lição' })
        expect(bar).toHaveAttribute('aria-valuenow', '7')
        expect(bar).toHaveAttribute('aria-valuemax', '15')
        expect(bar).toHaveAttribute('aria-valuetext', 'Cartão 7 de 15')
    })

    it('o preenchimento acompanha o cartão atual', () => {
        const { container } = render(<LessonProgressBar current={5} total={10} markers={[]} />)

        expect(container.querySelector<HTMLElement>('[class*="fill"]')?.style.width).toBe('50%')
    })

    it('cada pergunta vira um marco posicionado e escondido do leitor de tela', () => {
        const { container } = render(
            <LessonProgressBar
                current={3}
                total={10}
                markers={[
                    { position: 2, state: 'first-try' },
                    { position: 4, state: 'later' },
                    { position: 8, state: 'pending' },
                ]}
            />,
        )

        const markers = container.querySelectorAll<HTMLElement>('[class*="marker"]')
        expect([...markers].map((marker) => marker.style.left)).toEqual(['20%', '40%', '80%'])
        expect(markers[0].className).toContain('markerFirstTry')
        expect(markers[1].className).toContain('markerLater')
        expect(markers[2].className).toContain('markerPending')
        markers.forEach((marker) => expect(marker).toHaveAttribute('aria-hidden', 'true'))
    })
})
