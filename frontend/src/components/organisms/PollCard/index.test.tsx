import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PollCard } from '.'

const block = {
    type: 'poll' as const,
    id: 'e1',
    prompt: 'Com R$ 1.000 de bônus, o que você faria?',
    options: ['Deixaria na conta', 'Investiria', 'Gastaria'],
    closing: 'Não existe resposta certa aqui.',
}

describe('PollCard', () => {
    it('antes do voto mostra só as alternativas, sem resultado nem fechamento', () => {
        render(<PollCard block={block} state={undefined} pending={false} error={false} onVote={() => {}} />)

        expect(screen.getByText(block.prompt)).toBeInTheDocument()
        expect(screen.getAllByRole('button')).toHaveLength(3)
        expect(screen.queryByText('Não existe resposta certa aqui.')).not.toBeInTheDocument()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('um toque registra o voto pelo índice da alternativa', () => {
        const onVote = vi.fn()
        render(<PollCard block={block} state={undefined} pending={false} error={false} onVote={onVote} />)

        fireEvent.click(screen.getByRole('button', { name: 'Investiria' }))

        expect(onVote).toHaveBeenCalledWith(1)
    })

    it('com poucos votos convida e não mostra porcentagem', () => {
        render(<PollCard block={block} state={{ pollId: 'e1', vote: 1 }} pending={false} error={false} onVote={() => {}} />)

        expect(screen.getByText('Você está entre os primeiros a responder.')).toBeInTheDocument()
        expect(screen.queryByText(/%/)).not.toBeInTheDocument()
        expect(screen.getByText('Seu voto')).toBeInTheDocument()
        expect(screen.getByText('Não existe resposta certa aqui.')).toBeInTheDocument()
        expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('com votos suficientes mostra o percentual de cada alternativa e quantos responderam como você', () => {
        const state = { pollId: 'e1', vote: 0, results: { total: 34, percentages: [62, 24, 14] } }
        render(<PollCard block={block} state={state} pending={false} error={false} onVote={() => {}} />)

        expect(screen.getByText('62%')).toBeInTheDocument()
        expect(screen.getByText('24%')).toBeInTheDocument()
        expect(screen.getByText('62% responderam como você.')).toBeInTheDocument()
        expect(screen.getByText('34 respostas')).toBeInTheDocument()
    })

    it('mostra aviso quando o voto não foi registrado', () => {
        render(<PollCard block={block} state={undefined} pending={false} error onVote={() => {}} />)

        expect(screen.getByRole('alert')).toHaveTextContent('Não deu para registrar seu voto')
    })
})
