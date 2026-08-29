import { useState } from 'react'
import { Button } from '../../atoms/Button'
import { formatCurrency } from '../../../features/portfolio/format'
import type { OrderSide } from '../../../services/market'
import type { EquityOrderTicketProps } from './types'
import styles from './index.module.css'

export type { EquityOrderTicketProps } from './types'

// Ticket de ordem da tela 4.5 (mockup vivo, identidade-visual-padroes.md
// §0/§5) — toggle Comprar/Vender neutro (azul de marca, nunca verde/
// vermelho de ganho/perda — cor financeira é exclusiva de dado real) +
// stepper de quantidade com price-flash (~350ms, §2) a cada mudança.
export function EquityOrderTicket({ unitPrice, onSubmit }: EquityOrderTicketProps) {
    const [side, setSide] = useState<OrderSide>('buy')
    const [quantity, setQuantity] = useState(1)
    const [flash, setFlash] = useState(false)

    function changeQuantity(next: number) {
        setQuantity(Math.max(1, next))
        setFlash(true)
        setTimeout(() => setFlash(false), 350)
    }

    const total = unitPrice !== undefined ? unitPrice * quantity : undefined

    return (
        <div className={styles.ticket}>
            <span className={styles.title}>Nova ordem</span>

            <div className={styles.toggle}>
                <button
                    type="button"
                    className={[styles.toggleButton, side === 'buy' && styles.toggleActive].filter(Boolean).join(' ')}
                    onClick={() => setSide('buy')}
                >
                    Comprar
                </button>
                <button
                    type="button"
                    className={[styles.toggleButton, side === 'sell' && styles.toggleActive].filter(Boolean).join(' ')}
                    onClick={() => setSide('sell')}
                >
                    Vender
                </button>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>Quantidade</span>
                <div className={styles.stepper}>
                    <button type="button" className={styles.stepButton} onClick={() => changeQuantity(quantity - 1)} aria-label="Diminuir">
                        −
                    </button>
                    <span className={`${styles.qty} tabular-nums`}>{quantity}</span>
                    <button type="button" className={styles.stepButton} onClick={() => changeQuantity(quantity + 1)} aria-label="Aumentar">
                        +
                    </button>
                </div>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>Preço unitário</span>
                <span className={`${styles.unitPrice} tabular-nums`}>{unitPrice !== undefined ? formatCurrency(unitPrice) : '—'}</span>
            </div>

            <div className={styles.totalRow}>
                <span className={styles.label}>Total</span>
                <span className={[styles.total, 'tabular-nums', flash && styles.flash].filter(Boolean).join(' ')}>
                    {total !== undefined ? formatCurrency(total) : '—'}
                </span>
            </div>

            <Button fullWidth disabled={unitPrice === undefined} onClick={() => onSubmit(side, quantity)}>
                Revisar ordem
            </Button>
        </div>
    )
}
