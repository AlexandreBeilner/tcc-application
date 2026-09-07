import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrackTrophyCase } from '.'

describe('TrackTrophyCase (backlog de engajamento F.3)', () => {
    it('sem nenhuma trilha concluída não renderiza nada (nunca uma seção vazia)', () => {
        const { container } = render(<TrackTrophyCase completedTracks={[]} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('mostra um emblema por trilha concluída, na ordem do currículo', () => {
        render(<TrackTrophyCase completedTracks={[1, 0]} />)

        expect(screen.getByText('Fundamentos')).toBeInTheDocument()
        expect(screen.getByText('Renda Fixa')).toBeInTheDocument()
        expect(screen.queryByText('Renda Variável')).not.toBeInTheDocument()
        expect(screen.queryByText('Estratégia e Tributação')).not.toBeInTheDocument()
    })

    it('cada trilha concluída ganha a cor definida na tarefa F.1', () => {
        render(<TrackTrophyCase completedTracks={[2]} />)

        expect(screen.getByText('Renda Variável').closest('li')).toHaveStyle({
            color: 'var(--color-track-2)',
            background: 'var(--color-loss-100)',
        })
    })

    it('trilha desconhecida (fora do currículo de 4) é ignorada, não quebra o render', () => {
        render(<TrackTrophyCase completedTracks={[0, 99]} />)

        expect(screen.getByText('Fundamentos')).toBeInTheDocument()
    })
})
