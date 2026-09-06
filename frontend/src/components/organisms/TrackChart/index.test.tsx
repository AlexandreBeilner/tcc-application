import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { TrackChart } from '.'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'lesson',
        code: '0.1',
        title: 'Lição',
        trackNumber: 0,
        trackName: 'Fundamentos',
        sortOrder: 1,
        centralConcept: '',
        scenarioText: '',
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: '',
        unlocksDescription: '',
        unlocksKeys: [],
        unlocksAssetTicker: null,
        status: 'locked',
        currentStep: 0,
        ...overrides,
    }
}

describe('TrackChart', () => {
    it('não renderiza nada com menos de 2 lições', () => {
        const { container } = render(<TrackChart lessons={[lesson({ id: '1' })]} expandedHintId={null} onNodeClick={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renderiza um nó por lição, com o rótulo de status certo', () => {
        render(
            <TrackChart
                lessons={[
                    lesson({ id: '1', title: 'O que é investir', status: 'completed' }),
                    lesson({ id: '2', title: 'Inflação', status: 'available' }),
                    lesson({ id: '3', title: 'Rendimento real', status: 'locked', unlocksDescription: 'Renda Fixa' }),
                ]}
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.getByRole('button', { name: 'O que é investir: Concluída' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Inflação: Disponível' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Rendimento real: Bloqueada: libera Renda Fixa' })).toBeInTheDocument()
    })

    it('cada nó carrega um tooltip com título e status — inclusive os bloqueados/futuros', () => {
        render(
            <TrackChart
                lessons={[
                    lesson({ id: '1', title: 'O que é investir', status: 'completed' }),
                    lesson({ id: '2', title: 'Rendimento real', status: 'locked', unlocksDescription: 'Renda Fixa' }),
                ]}
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.getByText('O que é investir')).toBeInTheDocument()
        expect(screen.getByText('Concluída')).toBeInTheDocument()
        expect(screen.getByText('Rendimento real')).toBeInTheDocument()
        expect(screen.getByText('Bloqueada: libera Renda Fixa')).toBeInTheDocument()
    })

    it('clicar num nó chama onNodeClick com a lição', () => {
        const onNodeClick = vi.fn()
        const lessons = [lesson({ id: '1', title: 'Disponível agora', status: 'available' }), lesson({ id: '2', status: 'locked' })]
        render(<TrackChart lessons={lessons} expandedHintId={null} onNodeClick={onNodeClick} />)

        fireEvent.click(screen.getByRole('button', { name: /Disponível agora/ }))

        expect(onNodeClick).toHaveBeenCalledWith(lessons[0])
    })

    it('ancora o tooltip pela ponta (não centralizado) nos nós perto da borda do gráfico (tarefa 6.9.7)', () => {
        const { container } = render(
            <TrackChart
                lessons={[
                    lesson({ id: '1', title: 'Primeira', status: 'completed' }),
                    lesson({ id: '2', title: 'Meio', status: 'available' }),
                    lesson({ id: '3', title: 'Última', status: 'locked' }),
                ]}
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        const buttons = container.querySelectorAll('button')
        expect(buttons[0].querySelector('[class*="tooltipLeft"]')).toBeInTheDocument()
        expect(buttons[0].querySelector('[class*="tooltipRight"]')).not.toBeInTheDocument()
        expect(buttons[1].querySelector('[class*="tooltipLeft"]')).not.toBeInTheDocument()
        expect(buttons[1].querySelector('[class*="tooltipRight"]')).not.toBeInTheDocument()
        expect(buttons[2].querySelector('[class*="tooltipRight"]')).toBeInTheDocument()
        expect(buttons[2].querySelector('[class*="tooltipLeft"]')).not.toBeInTheDocument()
    })

    it('mostra a dica só quando expandedHintId aponta pra uma lição deste gráfico', () => {
        const lessons = [lesson({ id: '1', status: 'available' }), lesson({ id: '2', status: 'locked' })]
        const { rerender } = render(<TrackChart lessons={lessons} expandedHintId={null} onNodeClick={vi.fn()} />)
        expect(screen.queryByText('Conclua a lição anterior pra desbloquear.')).not.toBeInTheDocument()

        rerender(<TrackChart lessons={lessons} expandedHintId="2" onNodeClick={vi.fn()} />)
        expect(screen.getByText('Conclua a lição anterior pra desbloquear.')).toBeInTheDocument()
    })
})
