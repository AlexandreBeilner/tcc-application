import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listLessons } from '../../../services/lessons'
import { glossary } from '../../../features/lessons/glossary'
import { allTermCards } from '../../../features/lessons/termCollection'
import { TermCollection } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/lessons', () => ({ listLessons: vi.fn() }))

function renderCollection(props: { completedLessonCodes: string[]; isOwn: boolean }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <TermCollection {...props} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const fgc = glossary['FGC']!

describe('TermCollection (LJ.5.9)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listLessons).mockResolvedValue({ lessons: [{ id: 'lesson-fgc', code: fgc.originLesson as string }] as never })
    })
    afterEach(() => vi.clearAllMocks())

    it('no próprio perfil mostra "N de M", as cartas ganhas e, recolhidas, as que faltam sem o termo', () => {
        const total = allTermCards().length
        renderCollection({ completedLessonCodes: ['1.5'], isOwn: true })

        const earned = allTermCards().filter((card) => card.lessonCode === '1.5').length
        expect(screen.getByRole('heading', { name: `Seus termos: ${earned} de ${total}` })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'FGC' })).toBeInTheDocument()
        // As por ganhar ficam recolhidas, e quando abertas não revelam o termo.
        expect(screen.queryByLabelText(/^Carta por ganhar/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: `Ver as ${total - earned} cartas que faltam` }))
        expect(screen.getAllByLabelText(/^Carta por ganhar, da trilha/).length).toBe(total - earned)
        expect(screen.queryByText('EBIT')).not.toBeInTheDocument()
    })

    it('tocar numa carta ganha abre a definição e o atalho "Rever a lição"', async () => {
        renderCollection({ completedLessonCodes: ['1.5'], isOwn: true })

        fireEvent.click(screen.getByRole('button', { name: 'FGC' }))

        expect(screen.getByText(fgc.definition)).toBeInTheDocument()
        expect(await screen.findByRole('link', { name: 'Rever a lição' })).toHaveAttribute('href', '/trilha/lesson-fgc')
    })

    it('no perfil de outra pessoa mostra a contagem e as cartas ganhas, nunca as que faltam nem o atalho', () => {
        renderCollection({ completedLessonCodes: ['1.5'], isOwn: false })

        expect(screen.getByRole('heading', { name: /^Termos aprendidos: \d+$/ })).toBeInTheDocument()
        expect(screen.queryByText(/ de \d+$/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'FGC' }))
        expect(screen.queryByRole('link', { name: 'Rever a lição' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /cartas que faltam/ })).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/^Carta por ganhar/)).not.toBeInTheDocument()
        expect(listLessons).not.toHaveBeenCalled()
    })

    it('perfil de outra pessoa sem nenhuma carta não mostra a seção; o próprio convida a ganhar a primeira', () => {
        const { container, unmount } = renderCollection({ completedLessonCodes: [], isOwn: false })
        expect(container).toBeEmptyDOMElement()
        unmount()

        renderCollection({ completedLessonCodes: [], isOwn: true })
        expect(screen.getByText('Conclua uma lição para ganhar a primeira carta.')).toBeInTheDocument()
    })
})
