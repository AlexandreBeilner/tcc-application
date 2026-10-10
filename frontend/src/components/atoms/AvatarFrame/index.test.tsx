import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from '../Avatar'
import { AvatarFrame } from '.'

describe('AvatarFrame (MO.5.1)', () => {
    it('sem moldura devolve só o filho, sem wrapper', () => {
        const { container } = render(
            <AvatarFrame frame={null}>
                <span>x</span>
            </AvatarFrame>,
        )
        expect(container.innerHTML).toBe('<span>x</span>')
    })

    it('moldura conhecida embrulha o filho com a chave no data-frame', () => {
        const { container } = render(
            <AvatarFrame frame="frame_aurora">
                <span>x</span>
            </AvatarFrame>,
        )
        expect(container.querySelector('[data-frame="frame_aurora"]')).not.toBeNull()
    })

    it('moldura desconhecida (item novo sem visual neste build) não quebra: some', () => {
        const { container } = render(
            <AvatarFrame frame="frame_futura">
                <span>x</span>
            </AvatarFrame>,
        )
        expect(container.innerHTML).toBe('<span>x</span>')
    })

    it('Avatar aplica a moldura recebida', () => {
        const { container } = render(<Avatar username="ana" frame="frame_oceano" />)
        expect(container.querySelector('[data-frame="frame_oceano"]')).not.toBeNull()
        expect(screen.queryByText('A')).not.toBeNull()
    })
})
