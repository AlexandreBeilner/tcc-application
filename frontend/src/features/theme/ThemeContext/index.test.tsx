import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider, useTheme } from '.'

const THEME_STORAGE_KEY = 'tcc.theme'

function Consumer() {
    const { theme, setTheme } = useTheme()
    return (
        <div>
            <span data-testid="theme">{theme}</span>
            <button onClick={() => setTheme('light')}>claro</button>
            <button onClick={() => setTheme('dark')}>escuro</button>
        </div>
    )
}

describe('ThemeContext (tarefa 6.10.7)', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    afterEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    it('nasce dark por padrão e aplica `data-theme` no <html>', () => {
        render(
            <ThemeProvider>
                <Consumer />
            </ThemeProvider>,
        )

        expect(screen.getByTestId('theme').textContent).toBe('dark')
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('troca de tema atualiza o DOM e persiste em localStorage', () => {
        render(
            <ThemeProvider>
                <Consumer />
            </ThemeProvider>,
        )

        fireEvent.click(screen.getByText('claro'))

        expect(screen.getByTestId('theme').textContent).toBe('light')
        expect(document.documentElement.getAttribute('data-theme')).toBe('light')
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    })

    it('nasce lendo o valor persistido em localStorage', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light')

        render(
            <ThemeProvider>
                <Consumer />
            </ThemeProvider>,
        )

        expect(screen.getByTestId('theme').textContent).toBe('light')
    })
})
