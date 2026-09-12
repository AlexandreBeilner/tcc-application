import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { TrackPath } from '.'

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
        microDecisionOptions: null,
        status: 'locked',
        currentStep: 0,
        ...overrides,
    }
}

describe('TrackPath', () => {
    it('não renderiza nada com menos de 2 lições', () => {
        const { container } = render(
            <TrackPath lessons={[lesson({ id: '1' })]} accentColor="var(--color-track-0)" expandedHintId={null} onNodeClick={vi.fn()} />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renderiza um nó por lição, com o rótulo de status e o código/título sempre visíveis (sem tooltip)', () => {
        render(
            <TrackPath
                lessons={[
                    lesson({ id: '1', code: '0.1', title: 'O que é investir', status: 'completed' }),
                    lesson({ id: '2', code: '0.2', title: 'Inflação', status: 'available' }),
                    lesson({ id: '3', code: '0.3', title: 'Rendimento real', status: 'locked', unlocksDescription: 'Renda Fixa' }),
                ]}
                accentColor="var(--color-track-0)"
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.getByRole('button', { name: 'O que é investir: Concluída' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Inflação: Disponível' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Rendimento real: Bloqueada: libera Renda Fixa' })).toBeInTheDocument()
        expect(screen.getByText('0.1')).toBeInTheDocument()
        expect(screen.getByText('O que é investir')).toBeInTheDocument()
    })

    it('marca a lição available com a linha-guia "você está aqui"', () => {
        render(
            <TrackPath
                lessons={[lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'available' })]}
                accentColor="var(--color-track-0)"
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.getByText('Você está aqui')).toBeInTheDocument()
    })

    it('sem lição available, não mostra a linha-guia', () => {
        render(
            <TrackPath
                lessons={[lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'completed' })]}
                accentColor="var(--color-track-0)"
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.queryByText('Você está aqui')).not.toBeInTheDocument()
    })

    it('lição com unlocksDescription ganha a bandeira de marco', () => {
        render(
            <TrackPath
                lessons={[
                    lesson({ id: '1', status: 'completed', unlocksDescription: 'negociar Ações' }),
                    lesson({ id: '2', status: 'locked' }),
                ]}
                accentColor="var(--color-track-0)"
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.getByText('Libera negociar Ações')).toBeInTheDocument()
    })

    it('lição sem unlocksDescription não ganha bandeira', () => {
        render(
            <TrackPath
                lessons={[lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'locked' })]}
                accentColor="var(--color-track-0)"
                expandedHintId={null}
                onNodeClick={vi.fn()}
            />,
        )

        expect(screen.queryByText(/^Libera/)).not.toBeInTheDocument()
    })

    it('clicar num nó chama onNodeClick com a lição', () => {
        const onNodeClick = vi.fn()
        const lessons = [lesson({ id: '1', title: 'Disponível agora', status: 'available' }), lesson({ id: '2', status: 'locked' })]
        render(<TrackPath lessons={lessons} accentColor="var(--color-track-0)" expandedHintId={null} onNodeClick={onNodeClick} />)

        fireEvent.click(screen.getByRole('button', { name: /Disponível agora/ }))

        expect(onNodeClick).toHaveBeenCalledWith(lessons[0])
    })

    it('mostra a dica só quando expandedHintId aponta pra uma lição deste mapa', () => {
        const lessons = [lesson({ id: '1', status: 'available' }), lesson({ id: '2', status: 'locked' })]
        const { rerender } = render(
            <TrackPath lessons={lessons} accentColor="var(--color-track-0)" expandedHintId={null} onNodeClick={vi.fn()} />,
        )
        expect(screen.queryByText('Conclua a lição anterior pra desbloquear.')).not.toBeInTheDocument()

        rerender(<TrackPath lessons={lessons} accentColor="var(--color-track-0)" expandedHintId="2" onNodeClick={vi.fn()} />)
        expect(screen.getByText('Conclua a lição anterior pra desbloquear.')).toBeInTheDocument()
    })
})
