import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CosmeticTags } from './index'

describe('CosmeticTags', () => {
    it('mostra selo e título de quem é PRO', () => {
        render(<CosmeticTags cosmetics={{ isPro: true, frame: null, title: 'Estrategista' }} />)
        expect(screen.getByLabelText('Assinante PRO')).toBeInTheDocument()
        expect(screen.getByText('Estrategista')).toBeInTheDocument()
    })

    it('não renderiza nada para quem não é PRO', () => {
        const { container } = render(<CosmeticTags cosmetics={{ isPro: false, frame: null, title: null }} />)
        expect(container).toBeEmptyDOMElement()
    })
})
