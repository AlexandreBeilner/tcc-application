import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminDailySplit } from '.'

describe('AdminDailySplit', () => {
    it('mostra só a lista quando não há formulário', () => {
        render(<AdminDailySplit form={null}>lista</AdminDailySplit>)
        expect(screen.getByText('lista')).toBeInTheDocument()
    })

    it('mostra o formulário aberto ao lado da lista', () => {
        render(<AdminDailySplit form={<p>formulário</p>}>lista</AdminDailySplit>)
        expect(screen.getByText('formulário')).toBeInTheDocument()
        expect(screen.getByText('lista')).toBeInTheDocument()
    })
})
