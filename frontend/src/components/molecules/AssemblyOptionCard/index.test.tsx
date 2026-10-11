import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AssemblyOption } from '../../../services/assemblies'
import { AssemblyOptionCard } from '.'

const option = (over: Partial<AssemblyOption> = {}): AssemblyOption => ({
    id: 'o1',
    key: 'reinvestir',
    label: 'Reinvestir mais no negócio',
    gain: 'Mais recursos para crescer.',
    loss: 'Sobra menos dividendo agora.',
    effect: { metric: 'payout', direction: -1, intensity: 1 },
    effects: [
        { metric: 'payout', direction: -1, intensity: 1 },
        { metric: 'growth', direction: 1, intensity: 0.5 },
    ],
    position: 0,
    ...over,
})

const base = { score: undefined, mine: false, winner: false, canVote: false, pending: false, onVote: vi.fn(), hasVoted: false }

describe('AssemblyOptionCard (MO.6.14)', () => {
    it('mostra os dois efeitos lado a lado, no mesmo peso e na ordem da pauta', () => {
        render(<AssemblyOptionCard option={option()} {...base} />)
        const list = screen.getByRole('list', { name: 'O que esta opção muda na empresa' })
        const items = within(list).getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('Empurra para baixo a parte do lucro que a empresa distribui como dividendo')
        expect(items[1]).toHaveTextContent('Empurra para cima o ritmo de crescimento da empresa')
    })

    it('a política de dividendo aparece pelo valor-alvo, sem sentido nem intensidade', () => {
        render(
            <AssemblyOptionCard option={option({ effect: null, effects: [{ metric: 'dividend_policy', value: 'annual' }] })} {...base} />,
        )
        expect(screen.getByText('A empresa passa a pagar dividendo uma vez por ano.')).toBeInTheDocument()
    })

    it('não recomenda lado nem cita valor em reais ou percentual de payout', () => {
        const { container } = render(<AssemblyOptionCard option={option()} {...base} />)
        expect(container.textContent).not.toMatch(/R\$|recomend|melhor|%\s*de payout/i)
    })

    it('opção sem efeito conhecido não mostra a lista', () => {
        render(<AssemblyOptionCard option={option({ effect: null, effects: [] })} {...base} />)
        expect(screen.queryByRole('list', { name: 'O que esta opção muda na empresa' })).toBeNull()
    })

    it('segue votando pelo botão', () => {
        const onVote = vi.fn()
        render(<AssemblyOptionCard option={option()} {...base} canVote onVote={onVote} />)
        fireEvent.click(screen.getByRole('button', { name: 'Votar nesta opção' }))
        expect(onVote).toHaveBeenCalledWith('o1')
    })
})
