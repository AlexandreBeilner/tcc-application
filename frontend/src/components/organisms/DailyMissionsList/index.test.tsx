import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { DailyMission } from '../../../services/missions'
import { DailyMissionsList } from '.'

function mission(overrides: Partial<DailyMission>): DailyMission {
    return {
        id: 'm1',
        key: 'feed_read',
        title: 'Consulte o feed de notícias',
        description: 'Leia pelo menos um evento no feed hoje.',
        completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase.',
        xpReward: 10,
        requiresLessonCompletion: false,
        status: 'pending',
        ...overrides,
    }
}

function renderList(missions: DailyMission[], streak = 3) {
    const router = createMemoryRouter(
        [
            { path: '/', element: <DailyMissionsList missions={missions} streak={streak} /> },
            { path: '/noticias', element: <div>tela de notícias</div> },
            { path: '/calculadora', element: <div>tela de calculadora</div> },
            { path: '/trilha', element: <div>tela de trilha</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('DailyMissionsList (tela 7.3)', () => {
    it('clique numa missão navega pra tela que cumpre ela', () => {
        renderList([mission({ key: 'feed_read', title: 'Consulte o feed de notícias' })])

        fireEvent.click(screen.getByRole('button', { name: /Consulte o feed de notícias/ }))
        expect(screen.getByText('tela de notícias')).toBeInTheDocument()
    })

    it('mostra o streak atual e a recompensa de XP por missão', () => {
        renderList([mission({ xpReward: 15 })], 5)

        expect(screen.getByText(/5 dias seguidos/)).toBeInTheDocument()
        expect(screen.getByText(/15 XP/)).toBeInTheDocument()
    })

    it('todas concluídas mostra estado de celebração', () => {
        renderList([mission({ status: 'completed' })])

        expect(screen.getByText('Todas as missões de hoje concluídas! Volte amanhã pra mais.')).toBeInTheDocument()
    })

    it('sem missões não renderiza nada', () => {
        const { container } = renderList([])
        expect(container.textContent).toBe('')
    })
})
