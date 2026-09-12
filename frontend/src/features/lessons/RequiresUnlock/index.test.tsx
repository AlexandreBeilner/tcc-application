import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { useUnlockedKeys } from '../useUnlockedKeys'
import { RequiresUnlock } from '.'

vi.mock('../useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))

function lesson(overrides: Partial<Lesson> = {}): Lesson {
    return {
        id: 'lesson-1',
        code: '0.1',
        title: 'Poupança x CDB',
        sortOrder: 1,
        status: 'available',
        unlocksKeys: ['portfolio'],
        unlocksDescription: '',
        ...overrides,
    } as Lesson
}

function renderWithRouter(unlockKey: string) {
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <div>mapa da trilha</div> },
            { path: '/trilha/:id', element: <div>tela de lição</div> },
            {
                element: <RequiresUnlock unlockKey={unlockKey} />,
                children: [{ path: '/', element: <div>portfolio</div> }],
            },
        ],
        { initialEntries: ['/'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('RequiresUnlock', () => {
    it('sem a chave desbloqueada, mostra o conteúdo travado em vez de navegar embora (tarefa K.2)', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })

        renderWithRouter('portfolio')

        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
        expect(screen.queryByText('mapa da trilha')).not.toBeInTheDocument()
        expect(screen.getByText('Travado pela trilha')).toBeInTheDocument()
        expect(screen.getByText('Ainda não há lição cobrindo este produto.')).toBeInTheDocument()
    })

    it('sem a chave desbloqueada, mas com a lição que libera encontrada, mostra o código dela', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [lesson()],
            isLoading: false,
            isError: false,
        })

        renderWithRouter('portfolio')

        expect(screen.getByText('Desbloqueia na lição 0.1.')).toBeInTheDocument()
    })

    it('lição encontrada mas ainda locked pro usuário (hipotético): CTA cai no Mapa da Trilha, não na lição inacessível (N.3)', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [lesson({ status: 'locked' })],
            isLoading: false,
            isError: false,
        })

        renderWithRouter('portfolio')
        fireEvent.click(screen.getByText('Ir pra lição'))

        await waitFor(() => expect(screen.getByText('mapa da trilha')).toBeInTheDocument())
        expect(screen.queryByText('tela de lição')).not.toBeInTheDocument()
    })

    it('com a chave desbloqueada, renderiza a rota protegida', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['portfolio']),
            lessons: [],
            isLoading: false,
            isError: false,
        })

        renderWithRouter('portfolio')

        expect(screen.getByText('portfolio')).toBeInTheDocument()
    })

    it('enquanto carrega, não redireciona nem renderiza a rota', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: true, isError: false })

        renderWithRouter('portfolio')

        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
        expect(screen.queryByText('mapa da trilha')).not.toBeInTheDocument()
    })

    it('numa falha transitória de GET /lessons, não redireciona um usuário que pode já ter desbloqueado a chave', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: true })

        renderWithRouter('portfolio')

        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
        expect(screen.queryByText('mapa da trilha')).not.toBeInTheDocument()
    })
})
