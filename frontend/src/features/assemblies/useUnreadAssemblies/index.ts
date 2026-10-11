import { useSyncExternalStore } from 'react'
import { getSeenAssembliesSnapshot, getSeenAssemblyIds, hasUnseenAssembly, subscribeToSeenAssemblies } from '../unreadAssemblies'
import { useAssembliesQuery } from '../useAssemblies'

// Badge do sino de Notícias para assembleia aberta ainda não vista. Falso com o recurso desligado
// (a consulta responde 404 e não há dado).
export function useUnreadAssemblies(): boolean {
    const { data } = useAssembliesQuery({ status: 'open' })
    useSyncExternalStore(subscribeToSeenAssemblies, getSeenAssembliesSnapshot)
    return hasUnseenAssembly(
        (data?.open ?? []).map((a) => a.id),
        getSeenAssemblyIds(),
    )
}
