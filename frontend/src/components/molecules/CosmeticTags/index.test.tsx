import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CosmeticTags } from './index'

describe('CosmeticTags', () => {
    it('mostra o título escolhido', () => {
        render(<CosmeticTags cosmetics={{ frame: null, title: 'Estrategista' }} />)
        expect(screen.getByText('Estrategista')).toBeInTheDocument()
    })

    it('não renderiza nada para quem não escolheu título', () => {
        const { container } = render(<CosmeticTags cosmetics={{ frame: null, title: null }} />)
        expect(container).toBeEmptyDOMElement()
    })
})
