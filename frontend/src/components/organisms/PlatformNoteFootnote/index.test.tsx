import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlatformNoteFootnote } from '.'

const block = {
    type: 'widget' as const,
    id: 'n1',
    widget: 'platform-note',
    props: { brazil: 'O Copom se reúne 8 vezes por ano.', here: 'A cada 45 dias.', why: 'O tempo corre mais rápido.' },
}

describe('PlatformNoteFootnote', () => {
    it('fechado mostra só o selo; as três linhas existem no DOM com o resumo textual no grupo', () => {
        render(<PlatformNoteFootnote block={block} open={false} onToggle={() => {}} />)

        const group = screen.getByRole('group', { name: /^Na plataforma\. No Brasil: O Copom/ })
        expect(group).not.toHaveAttribute('open')
        expect(screen.getByText('Na plataforma')).toBeVisible()
        expect(screen.getAllByRole('term', { hidden: true }).map((el) => el.textContent)).toEqual(['No Brasil', 'Aqui', 'Por quê'])
    })

    it('aberto mostra as três linhas na ordem', () => {
        render(<PlatformNoteFootnote block={block} open onToggle={() => {}} />)

        expect(screen.getByRole('group')).toHaveAttribute('open')
        expect(screen.getByText('A cada 45 dias.')).toBeVisible()
    })

    it('avisa o player quando a pessoa abre pelo resumo', async () => {
        const onToggle = vi.fn()
        render(<PlatformNoteFootnote block={block} open={false} onToggle={onToggle} />)

        fireEvent.click(screen.getByText('Na plataforma'))

        // O evento `toggle` do `<details>` é assíncrono.
        await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true))
    })

    it('props fora do schema caem no fallback do widget, sem derrubar o cartão', () => {
        render(<PlatformNoteFootnote block={{ ...block, props: { brazil: 'só uma linha' } }} open={false} onToggle={() => {}} />)

        expect(screen.getByText('Este conteúdo interativo não está disponível agora.')).toBeInTheDocument()
    })
})
