import { EquityIndicatorsPanel } from '../EquityIndicatorsPanel'
import { useAssetByTicker } from '../../../features/market/useAssetByTicker'
import type { LiveIndicatorWidgetProps } from './types'

export type { LiveIndicatorWidgetProps } from './types'

// Indicadores fundamentalistas de uma ação real, ao vivo (antes o tipo
// `live_indicator` embutido direto no player; migrado pro registro, RC.3.1).
export function LiveIndicatorWidget({ ticker }: LiveIndicatorWidgetProps) {
    const { asset, isLoading } = useAssetByTicker(ticker)

    if (isLoading) {
        return <p aria-live="polite">Carregando indicador ao vivo…</p>
    }

    return <EquityIndicatorsPanel indicators={asset?.equity?.indicators} />
}
