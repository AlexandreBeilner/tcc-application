import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { commonOf, EMPTY_COMMON, learnMoreOf } from '../../../features/admin/dailyAdmin'
import { AdminDailyItemFields } from '.'

describe('AdminDailyItemFields', () => {
    it('pede a referência só quando há ligação de saiba mais', () => {
        const onChange = vi.fn()
        const { rerender } = render(<AdminDailyItemFields value={EMPTY_COMMON} onChange={onChange} />)
        expect(screen.queryByLabelText('Referência')).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Saiba mais'), { target: { value: 'glossary' } })
        expect(onChange).toHaveBeenCalledWith({ ...EMPTY_COMMON, learnKind: 'glossary' })

        rerender(<AdminDailyItemFields value={{ ...EMPTY_COMMON, learnKind: 'glossary' }} onChange={onChange} />)
        expect(screen.getByLabelText('Referência')).toBeInTheDocument()
    })

    it('converte de e para o formato da API', () => {
        const common = commonOf({ category: 'instituicoes', scope: 'fora', learn_more: { kind: 'lesson', ref: '2.1' } })
        expect(common).toEqual({ category: 'instituicoes', scope: 'fora', learnKind: 'lesson', learnRef: '2.1' })
        expect(learnMoreOf(common)).toEqual({ kind: 'lesson', ref: '2.1' })
        expect(learnMoreOf({ ...common, learnRef: '  ' })).toBeNull()
        expect(learnMoreOf({ ...common, learnKind: '' })).toBeNull()
    })
})
