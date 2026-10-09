import { BarChart3, CalendarClock, Landmark, Percent } from 'lucide-react'
import { formatPercentage } from '../../../features/portfolio/format'
import { formatRatePercent } from '../../../features/market/format'
import type { IndicatorSummaryCardsProps } from './types'
import styles from './index.module.css'

export type { IndicatorSummaryCardsProps } from './types'

// Cards de valor corrente da tela "Indicadores Econômicos" (tarefa M.4) —
// mesmo motivo visual de `NetWorthCards` (ícone + rótulo + número
// protagonista), mas sem sparkline: a regra de sparkline obrigatória
// (identidade-visual-padroes.md §2) é só pra card com valor monetário ou
// métrica de progresso, nenhum dos dois é o caso aqui (dado macro, não
// patrimônio/XP). `selic_rate` já vem em pontos percentuais
// (`formatRatePercent`); `ipca_monthly_rate`/`ipca_accumulated_12m` vêm
// como razão 0–1 (`formatPercentage`) — mesma distinção de escala do resto
// do módulo `market` (`services/market/types.ts`).
export function IndicatorSummaryCards({ latest, nextCopomSimulatedDay }: IndicatorSummaryCardsProps) {
    return (
        <div className={styles.cards}>
            <div className={styles.card}>
                <span className={styles.iconBadge} aria-hidden="true">
                    <Landmark size={18} strokeWidth={2} />
                </span>
                <span className={styles.label}>Selic (meta anual)</span>
                <span className={`${styles.value} tabular-nums`}>
                    {latest ? formatRatePercent(latest.selic_rate) : 'Aguardando a primeira atualização'}
                </span>
            </div>

            <div className={styles.card}>
                <span className={styles.iconBadge} aria-hidden="true">
                    <Percent size={18} strokeWidth={2} />
                </span>
                <span className={styles.label}>IPCA mensal</span>
                <span className={`${styles.value} tabular-nums`}>
                    {latest ? formatPercentage(latest.ipca_monthly_rate) : 'Aguardando a primeira atualização'}
                </span>
            </div>

            <div className={styles.card}>
                <span className={styles.iconBadge} aria-hidden="true">
                    <BarChart3 size={18} strokeWidth={2} />
                </span>
                <span className={styles.label}>IPCA acumulado 12m</span>
                <span className={`${styles.value} tabular-nums`}>
                    {latest ? formatPercentage(latest.ipca_accumulated_12m) : 'Aguardando a primeira atualização'}
                </span>
            </div>

            <div className={styles.card}>
                <span className={styles.iconBadge} aria-hidden="true">
                    <CalendarClock size={18} strokeWidth={2} />
                </span>
                <span className={styles.label}>Próximo Copom simulado</span>
                <span className={`${styles.value} tabular-nums`}>Dia {nextCopomSimulatedDay}</span>
            </div>
        </div>
    )
}
