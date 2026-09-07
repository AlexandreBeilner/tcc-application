import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RewardRevealProvider, useRewardReveal } from '.'

function Consumer() {
    const { show } = useRewardReveal()
    return (
        <div>
            <button onClick={() => show({ icon: <span />, title: '+20 XP', description: 'Você completou uma lição.' })}>disparar-xp</button>
            <button onClick={() => show({ icon: <span />, title: 'Você subiu de nível!' })}>disparar-level-up</button>
        </div>
    )
}

describe('RewardRevealProvider', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('sem nenhum show(), não renderiza reveal nenhum', () => {
        render(
            <RewardRevealProvider>
                <Consumer />
            </RewardRevealProvider>,
        )
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('show() exibe o reveal com o conteúdo passado', () => {
        render(
            <RewardRevealProvider>
                <Consumer />
            </RewardRevealProvider>,
        )
        fireEvent.click(screen.getByText('disparar-xp'))
        expect(screen.getByText('+20 XP')).toBeInTheDocument()
        expect(screen.getByText('Você completou uma lição.')).toBeInTheDocument()
    })

    it('dois show() em sequência aparecem um de cada vez, não sobrepostos', () => {
        render(
            <RewardRevealProvider>
                <Consumer />
            </RewardRevealProvider>,
        )
        fireEvent.click(screen.getByText('disparar-xp'))
        fireEvent.click(screen.getByText('disparar-level-up'))

        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(screen.getByText('+20 XP')).toBeInTheDocument()
        expect(screen.queryByText('Você subiu de nível!')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))

        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(screen.queryByText('+20 XP')).not.toBeInTheDocument()
        expect(screen.getByText('Você subiu de nível!')).toBeInTheDocument()
    })

    it('useRewardReveal fora do provider lança erro', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(() => render(<Consumer />)).toThrow('useRewardReveal precisa ser usado dentro de <RewardRevealProvider>')
        consoleError.mockRestore()
    })
})
