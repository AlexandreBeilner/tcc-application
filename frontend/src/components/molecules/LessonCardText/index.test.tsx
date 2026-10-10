import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LessonCardBody, LessonCardDots } from '.'

function renderBody(props: Partial<Parameters<typeof LessonCardBody>[0]> = {}) {
    const onReveal = vi.fn()
    render(
        <MemoryRouter>
            <LessonCardBody card={{ text: 'Texto simples', hidden: false }} revealed={false} onReveal={onReveal} lessons={[]} {...props} />
        </MemoryRouter>,
    )
    return { onReveal }
}

describe('LessonCardBody', () => {
    it('mostra o texto do cartão', () => {
        renderBody()

        expect(screen.getByText('Texto simples')).toBeInTheDocument()
    })

    it('cartão [revelar] esconde o texto atrás do botão até o toque', () => {
        const { onReveal } = renderBody({ card: { text: 'Resultado escondido', hidden: true } })

        expect(screen.queryByText('Resultado escondido')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))
        expect(onReveal).toHaveBeenCalledTimes(1)
    })

    it('depois de revelado mostra o texto', () => {
        renderBody({ card: { text: 'Resultado escondido', hidden: true }, revealed: true })

        expect(screen.getByText('Resultado escondido')).toBeInTheDocument()
    })

    it('referência {{ref:X.Y}} vira link pra lição quando ela existe e texto puro quando não existe', () => {
        renderBody({ card: { text: 'Veja {{ref:2.1}} e {{ref:9.9}}', hidden: false }, lessons: [{ id: 'l21', code: '2.1' }] })

        expect(screen.getByRole('link', { name: 'já visto na lição 2.1' })).toHaveAttribute('href', '/trilha/l21')
        expect(screen.getByText(/já visto na lição 9.9/)).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'já visto na lição 9.9' })).not.toBeInTheDocument()
    })
})

describe('LessonCardDots', () => {
    it('desenha um ponto por cartão, escondido de leitor de tela', () => {
        const { container } = render(<LessonCardDots total={3} current={1} />)

        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
        expect(container.firstElementChild?.children).toHaveLength(3)
    })
})
