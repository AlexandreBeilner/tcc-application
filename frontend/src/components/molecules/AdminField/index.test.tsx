import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminField, adminInputClass } from '.'

describe('AdminField', () => {
    it('liga o rótulo ao controle e mostra a dica', () => {
        render(
            <AdminField label="Título" hint="Até 80 letras">
                {(id) => <input id={id} className={adminInputClass} />}
            </AdminField>,
        )

        expect(screen.getByLabelText('Título')).toBeInTheDocument()
        expect(screen.getByText('Até 80 letras')).toBeInTheDocument()
    })
})
