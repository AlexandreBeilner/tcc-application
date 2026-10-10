import { useCallback, useSyncExternalStore } from 'react'

// `matchMedia` não existe em jsdom (testes) nem em ambiente sem janela: nesses
// casos devolve `false`, o que cai no layout mobile.
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
            const list = window.matchMedia(query)
            list.addEventListener('change', onChange)
            return () => list.removeEventListener('change', onChange)
        },
        [query],
    )
    const getSnapshot = useCallback(
        () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
        [query],
    )
    return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
