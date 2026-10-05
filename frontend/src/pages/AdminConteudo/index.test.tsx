import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAdminLessons } from '../../services/admin'
import { AdminConteudo } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getAdminLessons: vi.fn(), setLessonPublished: vi.fn() }))

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminLessons).mockResolvedValue({ lessons: [] })
})

describe('AdminConteudo', () => {
    it('mostra o título e consulta as lições uma vez', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={client}>
                <AdminConteudo />
            </QueryClientProvider>,
        )

        expect(screen.getByRole('heading', { name: 'Conteúdo' })).toBeInTheDocument()
        expect(await screen.findByText('Nenhuma lição cadastrada.')).toBeInTheDocument()
        expect(getAdminLessons).toHaveBeenCalledTimes(1)
    })
})
