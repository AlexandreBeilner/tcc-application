import { useAssetQuery } from '../useAssetQuery'
import { useAssetsQuery } from '../useAssetsQuery'
import type { AssetDetail } from '../../../services/market'

// Resolve ticker→ativo real do catálogo (2 chamadas: `GET /market/assets`
// pra achar o id pelo ticker, `GET /market/assets/:id` pro detalhe) — sem
// endpoint novo, mesma decisão da 7.0.1 (`unlockedKeys.ts`, sem endpoint
// próprio pra "chave desbloqueada"). Usado pela lição (tarefa 7.0.2,
// achado 6) pro CTA "Comprar agora" (`unlocksAssetTicker`) e pro indicador
// ao vivo do passo Revelação (`microDecisionAssetTicker`, tipo
// `live_indicator`). `ticker` nulo mantém as duas queries desabilitadas.
export function useAssetByTicker(ticker: string | null): { asset: AssetDetail | undefined; isLoading: boolean; isError: boolean } {
    const assetsQuery = useAssetsQuery(undefined, { enabled: ticker !== null })
    const summary = ticker ? assetsQuery.data?.assets.find((candidate) => candidate.ticker === ticker) : undefined
    const detailQuery = useAssetQuery(summary?.id ?? '', { enabled: summary !== undefined })

    return {
        asset: detailQuery.data?.asset,
        isLoading: assetsQuery.isLoading || (summary !== undefined && detailQuery.isLoading),
        isError: assetsQuery.isError || detailQuery.isError,
    }
}
