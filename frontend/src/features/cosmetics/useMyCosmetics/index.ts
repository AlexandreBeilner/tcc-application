import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { equipCosmetic, getMyCosmetics, unequipCosmetic } from '../../../services/cosmetics'
import type { CosmeticKind, MyCosmetics } from '../../../services/cosmetics'

export const MY_COSMETICS_QUERY_KEY = ['cosmetics', 'me'] as const

// Vitrine da própria conta (MO.5.1): catálogo, escolha guardada (mesmo de quem cancelou) e como
// os outros enxergam a pessoa agora.
export function useMyCosmeticsQuery(): UseQueryResult<MyCosmetics> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MY_COSMETICS_QUERY_KEY,
        queryFn: () => getMyCosmetics(token as string),
        enabled: token !== null,
    })
}

export interface CosmeticChange {
    kind: CosmeticKind
    // `null` tira o item do espaço.
    itemKey: string | null
}

// Equipar ou tirar um item. A resposta já traz o estado novo, que
// vai direto ao cache; o resto das telas (ranking, perfil, amigos) refaz a leitura na próxima vez.
export function useCosmeticChangeMutation(): UseMutationResult<MyCosmetics, unknown, CosmeticChange> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ kind, itemKey }: CosmeticChange) =>
            itemKey === null ? unequipCosmetic(token as string, kind) : equipCosmetic(token as string, kind, itemKey),
        onSuccess: (result) => {
            queryClient.setQueryData(MY_COSMETICS_QUERY_KEY, result)
            queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'cosmetics' })
        },
    })
}
