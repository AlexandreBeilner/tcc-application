import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LockedScreen } from '.'

describe('LockedScreen', () => {
    it('mostra o código da lição quando conhecido', () => {
        render(
            <MemoryRouter>
                <LockedScreen lessonId="lesson-1" lessonCode="0.1" />
            </MemoryRouter>,
        )

        expect(screen.getByText('Desbloqueia na lição 0.1.')).toBeInTheDocument()
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
