import { useState } from 'react'
import { Button } from '../../atoms/Button'
import { MarketClosedNotice } from '../../molecules/MarketClosedNotice'
import { formatCurrency } from '../../../features/portfolio/format'
import { estimateOrderCost, maxAffordableQuantity } from '../../../features/market/orderBook'
import type { BookLevel, OrderSide } from '../../../services/market'
import type { EquityOrderTicketProps } from './types'
import styles from './index.module.css'

export type { EquityOrderTicketProps } from './types'

// Ticket de ordem da tela 4.5 (mockup vivo, identidade-visual-padroes.md
// §0/§5) — toggle Comprar/Vender neutro (azul de marca, nunca verde/
// vermelho de ganho/perda — cor financeira é exclusiva de dado real) +
// stepper de quantidade com price-flash (~350ms, §2) a cada mudança.
// Custo estimado contra a profundidade real do book (tarefa S.5/S.7,
// achado 021 em pontos-em-aberto-decisao-produto.md: mostrar o último
// negócio como preço unitário escondia o spread real ~2% e fazia "comprar
// o máximo pelo último preço" cair em 422 genérico) — sandbox e ativo sem
// book carregado seguem no fallback de sempre (último negócio × quantidade).
export function EquityOrderTicket({ unitPrice, book, cashBalance, ownedQuantity, closedReason, onSubmit }: EquityOrderTicketProps) {
    const [side, setSide] = useState<OrderSide>('buy')
    const [quantity, setQuantity] = useState(1)
    const [flash, setFlash] = useState(false)

    function changeQuantity(next: number) {
        setQuantity(Math.max(1, next))
        setFlash(true)
        setTimeout(() => setFlash(false), 350)
    }

    const hasRealBook = book !== undefined && !book.is_sandbox
    const relevantLevels: BookLevel[] | null = hasRealBook ? (side === 'buy' ? (book!.asks ?? null) : (book!.bids ?? null)) : null
    const usingBookEstimate = relevantLevels !== null && relevantLevels.length > 0

    const estimate = estimateOrderCost(relevantLevels, quantity, unitPrice)
    const total = estimate.total

    function useMax() {
        if (side === 'buy') {
            const max = maxAffordableQuantity(hasRealBook ? (book!.asks ?? null) : null, cashBalance ?? 0)
            if (max > 0) changeQuantity(max)
            return
        }
        if (ownedQuantity && ownedQuantity > 0) changeQuantity(ownedQuantity)
    }

    const canUseMax = side === 'buy' ? cashBalance !== undefined && Boolean(book?.asks) : Boolean(ownedQuantity)

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

            {hasRealBook && (book.best_bid !== null || book.best_ask !== null) && (
                <div className={styles.row}>
                    <span className={styles.label}>Compra · Venda (book)</span>
                    <span className={`${styles.unitPrice} tabular-nums`}>
                        {book.best_bid !== null ? formatCurrency(book.best_bid) : '—'} ·{' '}
                        {book.best_ask !== null ? formatCurrency(book.best_ask) : '—'}
                    </span>
                </div>
            )}

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

            {canUseMax && (
                <div className={styles.maxRow}>
                    <button type="button" className={styles.maxButton} onClick={useMax}>
                        Usar o máximo
                    </button>
                </div>
            )}

            <div className={styles.row}>
                <span className={styles.label}>{usingBookEstimate ? 'Preço médio estimado' : 'Preço unitário'}</span>
                <span className={`${styles.unitPrice} tabular-nums`}>
                    {estimate.unitPrice !== undefined ? formatCurrency(estimate.unitPrice) : '—'}
                </span>
            </div>

            <div className={styles.totalRow}>
                <span className={styles.label}>{usingBookEstimate ? 'Custo estimado' : 'Total'}</span>
                <span className={[styles.total, 'tabular-nums', flash && styles.flash].filter(Boolean).join(' ')}>
                    {total !== undefined ? formatCurrency(total) : '—'}
                </span>
            </div>

            {estimate.boundedByDepth && (
                <p className={styles.depthNote}>
                    Profundidade visível do book insuficiente para essa quantidade, valor acima é uma estimativa.
                </p>
            )}

            <Button fullWidth disabled={unitPrice === undefined || Boolean(closedReason)} onClick={() => onSubmit(side, quantity)}>
                Revisar ordem
            </Button>
            {closedReason && <MarketClosedNotice reason={closedReason} />}
        </div>
    )
}
