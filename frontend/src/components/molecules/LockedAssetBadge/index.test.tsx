import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LockedAssetBadge } from '.'

describe('LockedAssetBadge', () => {
    it('mostra só o ícone de cadeado, sem código/título de lição (Fase Q)', () => {
        render(<LockedAssetBadge />)

        expect(screen.getByLabelText('Produto travado pela trilha')).toBeInTheDocument()
        expect(screen.queryByText(/Lição /)).not.toBeInTheDocument()
    })
})
