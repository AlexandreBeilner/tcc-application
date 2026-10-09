import { useCallback, useState } from 'react'
import type { CalendarScope } from '../../../services/market'

const STORAGE_KEY = 'app.calendar.scope'

// "Meus" (`mine`) é o padrão: o calendário abre no que afeta o usuário.
export const DEFAULT_CALENDAR_SCOPE: CalendarScope = 'mine'

function readScope(): CalendarScope {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored === 'mine' || stored === 'all' ? stored : DEFAULT_CALENDAR_SCOPE
    } catch {
        return DEFAULT_CALENDAR_SCOPE
    }
}

// Escopo do calendário (Meus/Todos), lembrado entre aberturas. O armazenamento
// pode estar bloqueado: a escolha vale na sessão e o app segue funcionando.
export function useCalendarScope(): [CalendarScope, (scope: CalendarScope) => void] {
    const [scope, setScope] = useState<CalendarScope>(readScope)

    const update = useCallback((next: CalendarScope) => {
        setScope(next)
        try {
            localStorage.setItem(STORAGE_KEY, next)
        } catch {
            // Sem armazenamento: a preferência só dura até fechar a aba.
        }
    }, [])

    return [scope, update]
}
