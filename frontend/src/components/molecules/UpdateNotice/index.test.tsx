import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markUpdateWaiting, resetUpdateStore } from '../../../features/pwa/updateStore'
import { UpdateNotice } from '.'

describe('UpdateNotice (LW.2.2)', () => {
    beforeEach(() => resetUpdateStore())

    it('não aparece sem versão nova', () => {
        render(<UpdateNotice />)

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('aparece quando há versão esperando e só atualiza no toque', () => {
        const apply = vi.fn()
        render(<UpdateNotice />)

        act(() => markUpdateWaiting(apply))

        expect(screen.getByRole('status')).toHaveTextContent('Nova versão disponível')
        expect(apply).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
        expect(apply).toHaveBeenCalledTimes(1)
    })
})
