import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listActiveAnnouncements } from '../../../services/announcements'
import type { ActiveAnnouncement } from '../../../services/announcements'

export const ACTIVE_ANNOUNCEMENTS_QUERY_KEY = ['announcements', 'active'] as const

const STORAGE_KEY = 'dismissedAnnouncements'

// Comunicado entra e sai por decisão do admin, não por tick: uma leitura por minuto basta.
const REFETCH_INTERVAL_MS = 60_000

// "Dispensar" vale pra sessão do navegador (a aba): guardado por id em `sessionStorage`,
// sempre dentro de try/catch (modo privado e site data bloqueado lançam no acesso).
export function readDismissedIds(): string[] {
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY)
        const parsed: unknown = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch {
        return []
    }
}

function writeDismissedIds(ids: string[]): void {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
        // Sem storage a dispensa vale só até a tela recarregar: o estado em memória cobre o resto.
    }
}

// O que a faixa mostra: o que está no ar, menos o que o usuário dispensou. Aviso não
// dispensável (manutenção) ignora a lista de dispensados mesmo que o id tenha sido gravado.
export function visibleAnnouncements(announcements: ActiveAnnouncement[], dismissedIds: string[]): ActiveAnnouncement[] {
    return announcements.filter((a) => !a.dismissible || !dismissedIds.includes(a.id))
}

export function useActiveAnnouncements(): {
    announcements: ActiveAnnouncement[]
    dismiss: (id: string) => void
} {
    const { token } = useAuth()
    const [dismissed, setDismissed] = useState<string[]>(readDismissedIds)

    const query = useQuery({
        queryKey: ACTIVE_ANNOUNCEMENTS_QUERY_KEY,
        queryFn: () => listActiveAnnouncements(token as string),
        enabled: token !== null,
        refetchInterval: REFETCH_INTERVAL_MS,
        staleTime: 30_000,
    })

    const announcements = useMemo(() => visibleAnnouncements(query.data?.announcements ?? [], dismissed), [query.data, dismissed])

    const dismiss = useCallback((id: string) => {
        setDismissed((current) => {
            if (current.includes(id)) return current
            const next = [...current, id]
            writeDismissedIds(next)
            return next
        })
    }, [])

    return { announcements, dismiss }
}
