import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonFeedbackSection } from '.'

describe('LessonFeedbackSection', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.stubGlobal(
            'Audio',
            class {
                volume = 1
                play = vi.fn().mockResolvedValue(undefined)
            },
        )
        Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true })
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        Reflect.deleteProperty(navigator, 'vibrate')
    })

    it('mostra som desligado e vibração ligada por padrão', () => {
        render(<LessonFeedbackSection />)

        expect(screen.getByRole('checkbox', { name: /Som/ })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: /Vibração/ })).toBeChecked()
    })

    it('grava a escolha só no navegador', () => {
        render(<LessonFeedbackSection />)

        fireEvent.click(screen.getByRole('checkbox', { name: /Som/ }))
        fireEvent.click(screen.getByRole('checkbox', { name: /Vibração/ }))

        expect(window.localStorage.getItem('app.lesson.sound')).toBe('1')
        expect(window.localStorage.getItem('app.lesson.vibration')).toBe('0')
    })

    it('esconde a vibração onde o aparelho não vibra', () => {
        Reflect.deleteProperty(navigator, 'vibrate')

        render(<LessonFeedbackSection />)

        expect(screen.queryByRole('checkbox', { name: /Vibração/ })).not.toBeInTheDocument()
    })
})
