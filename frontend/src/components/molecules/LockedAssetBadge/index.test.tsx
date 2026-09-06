import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LockedAssetBadge } from '.'

describe('LockedAssetBadge', () => {
    it('cita a lição que desbloqueia quando conhecida', () => {
        render(<LockedAssetBadge lessonCode="1.2" />)

        expect(screen.getByLabelText('Produto travado, desbloqueia na lição 1.2')).toBeInTheDocument()
    })

    it('mensagem genérica quando nenhuma lição ainda cobre a chave', () => {
        render(<LockedAssetBadge />)

        expect(screen.getByLabelText('Produto travado pela trilha')).toBeInTheDocument()
    })

    it('motivo do bloqueio fica visível na própria célula, não só em title/aria-label', () => {
        render(<LockedAssetBadge lessonCode="1.2" />)

        expect(screen.getByText('Lição 1.2')).toBeInTheDocument()
    })

    it('texto visível genérico quando nenhuma lição ainda cobre a chave', () => {
        render(<LockedAssetBadge />)

        expect(screen.getByText('Travado')).toBeInTheDocument()
    })
})
