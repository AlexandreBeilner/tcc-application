import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLessonShortcuts } from '.'

function Harness({ continueDisabled = false, overlay = false }: { continueDisabled?: boolean; overlay?: boolean }) {
    useLessonShortcuts()
    return (
        <div>
            <button data-lesson-back="" onClick={() => calls.push('back')}>
                Voltar
            </button>
            <button data-lesson-option="" onClick={() => calls.push('opt1')}>
                A
            </button>
            <button data-lesson-option="" onClick={() => calls.push('opt2')}>
                B
            </button>
            <button data-lesson-option="" disabled onClick={() => calls.push('opt3')}>
                C
            </button>
            <button data-lesson-submit="" onClick={() => calls.push('submit')}>
                Responder
            </button>
            <button data-lesson-continue="" disabled={continueDisabled} onClick={() => calls.push('continue')}>
                Continuar
            </button>
            <div data-lesson-widget="">
                <input type="range" aria-label="controle" />
                <button>dentro do widget</button>
            </div>
            <input aria-label="campo" />
            {overlay && <div role="dialog" aria-modal="true" />}
        </div>
    )
}

let calls: string[] = []

afterEach(() => {
    calls = []
})

describe('useLessonShortcuts: teclado', () => {
    it('setas voltam e continuam, e Enter responde quando há botão de responder habilitado', () => {
        render(<Harness />)

        fireEvent.keyDown(window, { key: 'ArrowLeft' })
        fireEvent.keyDown(window, { key: 'ArrowRight' })
        fireEvent.keyDown(window, { key: 'Enter' })

        expect(calls).toEqual(['back', 'continue', 'submit'])
    })

    it('Enter avança quando não há o que responder', () => {
        render(<Harness />)
        screen.getByText('Responder').setAttribute('disabled', '')

        fireEvent.keyDown(window, { key: 'Enter' })

        expect(calls).toEqual(['continue'])
    })

    it('Enter e seta direita não pulam o que o Continuar desabilitado trava', () => {
        render(<Harness continueDisabled />)
        screen.getByText('Responder').setAttribute('disabled', '')

        fireEvent.keyDown(window, { key: 'Enter' })
        fireEvent.keyDown(window, { key: 'ArrowRight' })

        expect(calls).toEqual([])
    })

    it('números 1 a 4 escolhem a alternativa pela posição, ignorando as descartadas e as que não existem', () => {
        render(<Harness />)

        fireEvent.keyDown(window, { key: '2' })
        fireEvent.keyDown(window, { key: '3' })
        fireEvent.keyDown(window, { key: '4' })
        fireEvent.keyDown(window, { key: '1' })

        expect(calls).toEqual(['opt2', 'opt1'])
    })

    it('Enter com o foco num botão deixa o botão agir sozinho (sem avançar duas vezes)', () => {
        render(<Harness />)

        fireEvent.keyDown(screen.getByText('A'), { key: 'Enter' })

        expect(calls).toEqual([])
    })

    it('não dispara em campo de texto, em controle deslizante nem em widget com foco', () => {
        render(<Harness />)

        for (const target of [screen.getByLabelText('campo'), screen.getByLabelText('controle'), screen.getByText('dentro do widget')]) {
            for (const key of ['ArrowLeft', 'ArrowRight', 'Enter', '1']) fireEvent.keyDown(target, { key })
        }

        expect(calls).toEqual([])
    })

    it('não dispara com modificador nem com uma janela aberta por cima', () => {
        const { rerender } = render(<Harness />)

        fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
        fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
        rerender(<Harness overlay />)
        fireEvent.keyDown(window, { key: 'ArrowRight' })

        expect(calls).toEqual([])
    })
})

describe('useLessonShortcuts: gestos', () => {
    afterEach(() => vi.useRealTimers())

    function swipe(target: Element, from: [number, number], to: [number, number], ms = 200) {
        vi.useFakeTimers()
        fireEvent.touchStart(target, { touches: [{ clientX: from[0], clientY: from[1] }] })
        vi.advanceTimersByTime(ms)
        fireEvent.touchEnd(target, { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
    }

    it('deslizar para a esquerda continua e para a direita volta', () => {
        render(<Harness />)

        swipe(document.body, [250, 300], [100, 310])
        swipe(document.body, [100, 300], [250, 290])

        expect(calls).toEqual(['continue', 'back'])
    })

    it('deslizar para a esquerda não pula o que o Continuar desabilitado trava', () => {
        render(<Harness continueDisabled />)

        swipe(document.body, [250, 300], [100, 300])

        expect(calls).toEqual([])
    })

    it('rolagem vertical, gesto curto e gesto lento não navegam', () => {
        render(<Harness />)

        swipe(document.body, [200, 100], [120, 400])
        swipe(document.body, [200, 300], [170, 300])
        swipe(document.body, [250, 300], [100, 300], 1500)

        expect(calls).toEqual([])
    })

    it('gesto que começa dentro de widget ou de campo é do widget', () => {
        render(<Harness />)

        swipe(screen.getByLabelText('controle'), [250, 300], [100, 300])
        swipe(screen.getByText('dentro do widget'), [250, 300], [100, 300])
        swipe(screen.getByLabelText('campo'), [250, 300], [100, 300])

        expect(calls).toEqual([])
    })

    it('pinça (dois dedos) nunca é gesto de navegação', () => {
        render(<Harness />)
        vi.useFakeTimers()

        fireEvent.touchStart(document.body, {
            touches: [
                { clientX: 250, clientY: 300 },
                { clientX: 300, clientY: 300 },
            ],
        })
        fireEvent.touchEnd(document.body, { changedTouches: [{ clientX: 100, clientY: 300 }] })

        expect(calls).toEqual([])
    })
})
