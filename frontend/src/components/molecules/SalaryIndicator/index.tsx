import { HandCoins } from 'lucide-react'
import { formatCurrency } from '../../../features/portfolio/format'
import type { SalaryIndicatorProps } from './types'
import styles from './index.module.css'

export type { SalaryIndicatorProps } from './types'

function nextPaymentLabel(daysUntilNextPayment: number | null | undefined): string | null {
    if (daysUntilNextPayment === undefined) return 'Carregando…'
    if (daysUntilNextPayment === null) return null
    if (daysUntilNextPayment === 0) return 'próximo pagamento hoje'
    return `próximo pagamento em ${daysUntilNextPayment} ${daysUntilNextPayment === 1 ? 'dia' : 'dias'}`
}

// Indicador persistente de salário (tarefa T.9), perto do resumo de progressão:
// valor mensal (T.8, fonte única — a fórmula em degraus nunca é duplicada aqui)
// e contagem até o próximo crédito (T.6, calendário do mercado, mesmo `HandCoins`
// de `CalendarKindIcon`). Steady-state, sem o teatro de recompensa reservado pro
// level-up (identidade-visual-padroes.md §6) — por isso fica neutro, não usa as
// cores de XP/streak nem as de ganho/perda.
export function SalaryIndicator({ monthlySalary, daysUntilNextPayment }: SalaryIndicatorProps) {
    const label = nextPaymentLabel(daysUntilNextPayment)

    return (
        <div className={styles.container}>
            <span className={styles.icon} aria-hidden="true">
                <HandCoins size={16} strokeWidth={2} />
            </span>
            <div className={styles.text}>
                <span className={styles.value}>Salário: {formatCurrency(monthlySalary)}/mês</span>
                {label && <span className={styles.detail}>{label}</span>}
            </div>
        </div>
    )
}
