import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getSeenAssemblyIds } from '../../../features/assemblies/unreadAssemblies'
import { listAssemblies } from '../../../services/assemblies'
import type { AssemblySummary } from '../../../services/assemblies'
import { ApiError } from '../../../services/client'
import { NewsAssemblies } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/assemblies', () => ({ listAssemblies: vi.fn() }))

const open: AssemblySummary = {
    id: 'a1',
    kind: 'shareholder',
    subjectRef: 'c1',
    subjectLabel: 'Acme',
    title: 'Destinação do lucro',
    status: 'open',
    opensAt: '2026-10-01T00:00:00Z',
    closesAt: '2099-10-08T00:00:00Z',
    effectAppliesAt: '2099-10-09T00:00:00Z',
    effectAppliedAt: null,
    outcome: null,
    outcomeReason: null,
    voterCount: null,
}

function renderIt() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <NewsAssemblies />
            </MemoryRouter>
        </QueryClientProvider>,
    )
    return container
}

describe('NewsAssemblies (MO.6.6)', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('mostra a votação aberta com atalho e marca como vista para apagar o ponto do sino', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [open], closed: [] })
        renderIt()

        expect(await screen.findByRole('link', { name: /Destinação do lucro/ })).toHaveAttribute('href', '/assembleias/a1')
        expect(getSeenAssemblyIds()).toEqual(['a1'])
    })

    it('some com o recurso desligado ou sem nada para mostrar', async () => {
        vi.mocked(listAssemblies).mockRejectedValue(new ApiError(404, 'x'))
        const off = renderIt()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(off).toBeEmptyDOMElement()

        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        const empty = renderIt()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(empty.querySelector('section')).toBeNull()
    })
})
