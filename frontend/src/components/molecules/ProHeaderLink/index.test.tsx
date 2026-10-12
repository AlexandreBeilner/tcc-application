import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProEntry } from '../../../features/billing/useProEntry'
import { ProHeaderLink } from '.'

vi.mock('../../../features/billing/useProEntry', () => ({ useProEntry: vi.fn() }))

function renderLink(entry: ReturnType<typeof useProEntry>) {
    vi.mocked(useProEntry).mockReturnValue(entry)
    render(
        <MemoryRouter>
            <ProHeaderLink />
        </MemoryRouter>,
    )
}

describe('ProHeaderLink (MO.9.8)', () => {
    afterEach(() => vi.clearAllMocks())

    it('convida quem não é PRO aos planos', () => {
        renderLink('visitor')
        expect(screen.getByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
    })

    it('não aparece para assinante nem sem entrada', () => {
        renderLink('subscriber')
        expect(screen.queryByRole('link')).toBeNull()
    })

    it('não aparece com a cobrança desligada ou carregando', () => {
        renderLink(null)
        expect(screen.queryByRole('link')).toBeNull()
    })
})
