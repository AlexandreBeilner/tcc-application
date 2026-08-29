import { useNavigate } from 'react-router-dom'
import { CandlestickChart, FlaskConical } from 'lucide-react'
import { Card } from '../../atoms/Card'
import { calculateAccountTotals } from '../../../features/portfolio/accountTotals'
import { formatCurrency } from '../../../features/portfolio/format'
import type { NetWorthCardsProps } from './types'
import styles from './index.module.css'

export type { NetWorthCardsProps } from './types'

// Tela 2.1 (inventário) pede "variação percentual" no card de mercado ao
// vivo — fora de escopo aqui: `GET /market/me/account` devolve preço médio
// de aquisição por posição, não o preço atual (marcação a mercado exigiria
// uma chamada a `GET /market/assets/:id` por posição, escopo da 6.5, não
// desta tarefa). Os cards mostram patrimônio a custo em vez de variação —
// o selo "ao vivo" abaixo é sobre o mercado estar aberto (fato real, RF/
// spec 3.1), nunca uma variação de preço inventada.
export function NetWorthCards({ account }: NetWorthCardsProps) {
    const navigate = useNavigate()
    const { liveInvested, sandboxInvested } = calculateAccountTotals(account.positions, account.fixedIncomePositions)
    const livePatrimony = account.cashBalance + liveInvested

    return (
        <div className={styles.cards}>
            <Card className={styles.cardLayout} onClick={() => navigate('/extrato')} aria-label="Ver extrato do mercado ao vivo">
                <div className={styles.cardHeader}>
                    <span className={styles.headerLeft}>
                        <span className={styles.iconBadge} aria-hidden="true">
                            <CandlestickChart size={15} strokeWidth={2} />
                        </span>
                        <span className={styles.label}>Mercado Ao Vivo</span>
                    </span>
                    <span className={styles.liveTag}>
                        <span className={styles.liveDot} aria-hidden="true" />
                        ao vivo
                    </span>
                </div>
                <span className={`${styles.total} tabular-nums`}>{formatCurrency(livePatrimony)}</span>
                <span className={styles.detail}>
                    Investido: <span className="tabular-nums">{formatCurrency(liveInvested)}</span>
                </span>
                <span className={styles.detail}>
                    Saldo em caixa: <span className="tabular-nums">{formatCurrency(account.cashBalance)}</span>
                </span>
            </Card>

            <Card
                className={`${styles.cardLayout} ${styles.sandbox}`}
                onClick={() => navigate('/extrato')}
                aria-label="Ver extrato do modo aprendizado"
            >
                <span className={styles.sandboxBadge}>Modo Aprendizado</span>
                <span className={styles.headerLeft}>
                    <span className={styles.iconBadge} aria-hidden="true">
                        <FlaskConical size={15} strokeWidth={2} />
                    </span>
                    <span className={styles.label}>Sandbox</span>
                </span>
                <span className={`${styles.total} tabular-nums`}>{formatCurrency(sandboxInvested)}</span>
                <span className={styles.detail}>Não conta pro ranking</span>
            </Card>
        </div>
    )
}
