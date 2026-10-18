import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { ResumeLessonCard } from '.'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'l1',
        code: '1.1',
        title: 'O que é renda fixa',
        trackNumber: 1,
        trackName: 'Renda Fixa',
        sortOrder: 1,
        centralConcept: '',
        scenarioText: 'a'.repeat(3000),
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: 'a'.repeat(1500),
        unlocksDescription: '',
        unlocksKeys: [],
        unlocksAssetTicker: null,
        microDecisionOptions: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

function renderCard(lessons: Lesson[]) {
    return render(
        <MemoryRouter>
            <ResumeLessonCard lessons={lessons} />
        </MemoryRouter>,
    )
}

describe('ResumeLessonCard', () => {
    it('lição nova: "Próxima lição" com a trilha e o tempo estimado', () => {
        renderCard([lesson({})])

        expect(screen.getByText('Próxima lição')).toBeInTheDocument()
        // 3000 + 1500 caracteres = 300 s = 5 min.
        expect(screen.getByText('Renda Fixa · ~5 min')).toBeInTheDocument()
    })

    it('lição em andamento: "Retomar lição" com o que falta', () => {
        renderCard([lesson({ currentStep: 2 })])

        expect(screen.getByText('Retomar lição')).toBeInTheDocument()
        // Só a Revelação (1500 caracteres = 100 s) falta, o que arredonda para o mínimo de 2 min.
        expect(screen.getByText('Renda Fixa · Faltam ~2 min')).toBeInTheDocument()
    })

    it('sem lição disponível não renderiza nada', () => {
        const { container } = renderCard([lesson({ status: 'completed' })])
        expect(container).toBeEmptyDOMElement()
    })
})
