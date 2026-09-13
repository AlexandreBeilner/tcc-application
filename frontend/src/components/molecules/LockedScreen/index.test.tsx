import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LockedScreen } from '.'

describe('LockedScreen', () => {
    it('mostra o título da lição quando conhecido (nunca o código, Fase Q)', () => {
        render(
            <MemoryRouter>
                <LockedScreen lessonId="lesson-1" lessonTitle="Poupança x CDB" />
            </MemoryRouter>,
        )

        expect(screen.getByText('Complete a lição "Poupança x CDB" na trilha pra liberar isso.')).toBeInTheDocument()
    })

    it('mensagem genérica quando nenhuma lição ainda cobre a chave', () => {
        render(
            <MemoryRouter>
                <LockedScreen />
            </MemoryRouter>,
        )

        expect(screen.getByText('Ainda não há lição cobrindo este produto.')).toBeInTheDocument()
    })
})
