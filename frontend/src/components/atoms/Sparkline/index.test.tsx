import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from '.'

describe('Sparkline', () => {
    it('desenha o caminho quando há série', () => {
        const { container } = render(<Sparkline values={[1, 2, 3]} />)
        expect(container.querySelector('svg path')).not.toBeNull()
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    it('sem série mantém um espaço do mesmo tamanho e sem svg', () => {
        const { container } = render(<Sparkline values={undefined} width={80} height={30} />)
        expect(container.querySelector('svg')).toBeNull()
        expect(container.firstElementChild).toHaveStyle({ width: '80px', height: '30px' })
    })
})
