import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { readStored, STORAGE_KEYS, writeStored } from '../../../utils/storage'
import type { Theme, ThemeContextValue } from './types'

export type { Theme, ThemeContextValue } from './types'

// Tarefa 6.10.7 (apontado pelo autor) — os tokens dark/light já existiam
// desde a 1.0 (`:root` / `:root[data-theme='light']` em `index.css`), só
// faltava o controle de UI pra alternar. Persistência em `localStorage`
// (decisão desta sessão: não sincroniza entre dispositivos, mesmo raciocínio
// de escopo do RNF07/6.0.2 — sem necessidade confirmada de ir além do MVP).

function readStoredTheme(): Theme {
    const stored = readStored(STORAGE_KEYS.theme)
    return stored === 'light' ? 'light' : 'dark'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(readStoredTheme)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        // LW.2.1: a barra do navegador/PWA acompanha o tema (valores de `--color-bg-base` em index.css).
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f7f9' : '#0e0f13')
        writeStored(STORAGE_KEYS.theme, theme)
    }, [theme])

    const value = useMemo(() => ({ theme, setTheme: setThemeState }), [theme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        throw new Error('useTheme precisa ser usado dentro de <ThemeProvider>')
    }
    return ctx
}
