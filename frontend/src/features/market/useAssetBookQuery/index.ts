import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAssetBook } from '../../../services/market'
import type { AssetBook } from '../../../services/market'

export function assetBookQueryKey(assetId: string) {
    return ['market', 'assets', 'book', assetId] as const
}

// Melhor bid/ask e profundidade resumida (tarefa S.5) — insumo do diálogo
// de ordem (S.7): custo estimado contra o book e "comprar o máximo". Relê
// a cada 15s enquanto o ticket está montado — o book muda a cada
// negociação de bot/usuário, diferente do relógio (60s) ou do calendário
// (sem polling).
export function useAssetBookQuery(assetId: string, options?: { enabled?: boolean }): UseQueryResult<{ book: AssetBook }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: assetBookQueryKey(assetId),
        queryFn: () => getAssetBook(token as string, assetId),
        enabled: token !== null && assetId !== '' && (options?.enabled ?? true),
        refetchInterval: 15_000,
    })
}
