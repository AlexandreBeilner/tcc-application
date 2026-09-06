import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LockedAssetBadge } from '.'

describe('LockedAssetBadge', () => {
    it('cita a lição que desbloqueia quando conhecida', () => {
        render(<LockedAssetBadge lessonCode="1.2" />)

        expect(screen.getByLabelText('Produto travado — desbloqueia na lição 1.2')).toBeInTheDocument()
    })

    it('mensagem genérica quando nenhuma lição ainda cobre a chave', () => {
        render(<LockedAssetBadge />)

        expect(screen.getByLabelText('Produto travado pela trilha')).toBeInTheDocument()
    })
})
