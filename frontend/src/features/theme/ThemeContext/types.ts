export type Theme = 'dark' | 'light'

export interface ThemeContextValue {
    theme: Theme
    setTheme(theme: Theme): void
}
