import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MoreDetails } from '.'

const block = {
    type: 'more' as const,
    id: 'm1',
    title: 'Pregão e custos',
    blocks: [{ type: 'text' as const, markup: 'O pregão funciona em dias úteis.' }],
}

describe('MoreDetails', () => {
    it('fechado mostra só o título e não monta o conteúdo', () => {
        render(<MoreDetails block={block} open={false} onToggle={() => {}} lessons={[]} />)

        expect(screen.getByRole('group')).not.toHaveAttribute('open')
        expect(screen.getByText('Saiba mais')).toBeVisible()
        expect(screen.getByText('Pregão e custos')).toBeVisible()
        expect(screen.queryByText('O pregão funciona em dias úteis.')).not.toBeInTheDocument()
    })

    it('aberto mostra o texto do detalhe', () => {
        render(<MoreDetails block={block} open onToggle={() => {}} lessons={[]} />)

        expect(screen.getByRole('group')).toHaveAttribute('open')
        expect(screen.getByText('O pregão funciona em dias úteis.')).toBeVisible()
    })

    it('avisa o player quando a pessoa abre pelo resumo', async () => {
        const onToggle = vi.fn()
        render(<MoreDetails block={block} open={false} onToggle={onToggle} lessons={[]} />)

        fireEvent.click(screen.getByText('Pregão e custos'))

        await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true))
    })
})
