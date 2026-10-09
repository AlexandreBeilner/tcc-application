import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformNote, platformNoteSummary } from '.'

const props = {
    brazil: 'O Copom se reúne 8 vezes por ano.',
    here: 'A cada 45 dias.',
    why: 'O tempo corre mais rápido.',
}

describe('PlatformNote', () => {
    it('mostra o selo e as três linhas na ordem', () => {
        render(<PlatformNote {...props} />)

        expect(screen.getByLabelText('Na plataforma')).toBeInTheDocument()
        const terms = screen.getAllByRole('term').map((el) => el.textContent)
        expect(terms).toEqual(['No Brasil', 'Aqui', 'Por quê'])
        expect(screen.getByText(props.brazil)).toBeInTheDocument()
        expect(screen.getByText(props.here)).toBeInTheDocument()
        expect(screen.getByText(props.why)).toBeInTheDocument()
    })

    it('o resumo textual traz as três linhas', () => {
        expect(platformNoteSummary(props)).toBe(
            'Na plataforma. No Brasil: O Copom se reúne 8 vezes por ano. Aqui: A cada 45 dias. Por quê: O tempo corre mais rápido.',
        )
    })
})
