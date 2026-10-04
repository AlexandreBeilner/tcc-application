import { IndicatorSummaryCards } from '../IndicatorSummaryCards'
import { nextCopomSimulatedDay } from '../../../features/market/nextCopomDay'
import { useIndicatorHistoryQuery } from '../../../features/market/useIndicatorHistoryQuery'
import type { LiveMacroWidgetProps } from './types'

export type { LiveMacroWidgetProps } from './types'

// Janela padrão: só precisa do valor mais recente pros cards de resumo,
// mesma fonte de `GET /market/indicators` (M.3) da tela Indicadores Econômicos.
const DEFAULT_WINDOW_DAYS = 90

// Selic/IPCA mais recentes ao vivo (antes o tipo `live_macro_indicator`
// embutido direto no player; migrado pro registro, RC.3.1).
export function LiveMacroWidget({ windowDays = DEFAULT_WINDOW_DAYS }: LiveMacroWidgetProps) {
    const history = useIndicatorHistoryQuery(windowDays)

    if (history.isLoading) {
        return <p aria-live="polite">Carregando indicador ao vivo…</p>
    }

    const latest = history.data?.indicators.at(-1)

    return <IndicatorSummaryCards latest={latest} nextCopomSimulatedDay={nextCopomSimulatedDay(latest?.simulated_day ?? 0)} />
}
