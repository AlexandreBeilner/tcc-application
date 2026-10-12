import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, BadgeDollarSign, Banknote, Landmark, ShieldCheck, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Delta } from '../../atoms/Delta'
import { formatCurrency } from '../../../features/portfolio/format'
import { formatRelativeDay } from '../../../features/market/movements'
import type { MovementKind } from '../../../features/market/movements'
import type { RecentMovementsProps } from './types'
import styles from './index.module.css'

export type { RecentMovementsProps } from './types'

const ICONS: Record<MovementKind, LucideIcon> = {
    buy: ArrowUpRight,
    sell: ArrowDownLeft,
    fixedIncomeIn: Landmark,
    fixedIncomeOut: Landmark,
    dividend: BadgeDollarSign,
    salary: Banknote,
    credit: ShieldCheck,
    deposit: Wallet,
}

// "Últimas movimentações" do Portfólio (MO.9.3): as 10 mais recentes do Mercado Ao Vivo, com ícone
// por tipo, valor com sinal e cor (Delta) e data relativa. O extrato completo é um link no rodapé.
export function RecentMovements({ movements, isLoading, isError, now }: RecentMovementsProps) {
    return (
        <div className={styles.box}>
            {isLoading && <div className={styles.skeleton} role="status" aria-label="Carregando movimentações" />}

            {isError && (
                <p className={styles.message} role="alert">
                    Não foi possível carregar suas movimentações agora.
                </p>
            )}

            {!isLoading && !isError && movements.length === 0 && <p className={styles.message}>Suas movimentações aparecem aqui.</p>}

            {movements.length > 0 && (
                <ul className={styles.list}>
                    {movements.map((movement) => {
                        const Icon = ICONS[movement.kind]
                        return (
                            <li key={movement.id} className={styles.row}>
                                <span className={styles.icon} aria-hidden="true">
                                    <Icon size={16} strokeWidth={2} />
                                </span>
                                <span className={styles.text}>
                                    <span className={styles.label}>{movement.label}</span>
                                    <span className={`${styles.meta} tabular-nums`}>
                                        {formatRelativeDay(movement.timestamp, now)}
                                        {movement.quantity !== undefined && movement.unitPrice !== undefined
                                            ? ` · ${movement.quantity} un. a ${formatCurrency(movement.unitPrice)}`
                                            : ''}
                                    </span>
                                </span>
                                <Delta amount={movement.amount} kind="flow" variant="text" className={styles.amount} />
                            </li>
                        )
                    })}
                </ul>
            )}

            <Link to="/extrato" className={styles.link}>
                Ver extrato completo
            </Link>
        </div>
    )
}
