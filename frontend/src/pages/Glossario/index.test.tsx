import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { Glossario } from '.'

vi.mock('../../features/lessons/useLessonsQuery', () => ({
    useLessonsQuery: () => ({ data: { lessons: [{ id: 'abc', code: '1.7', title: 'Tesouro Prefixado' }] } }),
}))

function renderPage() {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter>
                <Glossario />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Glossario', () => {
    it('lista os termos em ordem alfabética', () => {
        renderPage()
        const terms = screen.getAllByRole('term').map((el) => el.textContent ?? '')
        expect(terms.length).toBeGreaterThanOrEqual(40)
        expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })))
    })

    it('busca ignora acento e caixa', () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Buscar termo'), { target: { value: 'desagio' } })
        expect(screen.getAllByRole('term').map((el) => el.textContent)).toContain('deságio')
        expect(screen.queryByText('Selic')).not.toBeInTheDocument()
    })

    it('mostra exemplo e link para a lição de origem', () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Buscar termo'), { target: { value: 'deságio' } })
        expect(screen.getByText(/Um título de face R\$1\.000,00/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Tesouro Prefixado/ })).toHaveAttribute('href', '/trilha/abc')
    })

    it('avisa quando nada é encontrado', () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Buscar termo'), { target: { value: 'zzzz' } })
        expect(screen.getByText('Nenhum termo encontrado para essa busca.')).toBeInTheDocument()
    })
})
