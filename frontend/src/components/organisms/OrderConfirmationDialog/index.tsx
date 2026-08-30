import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import { OrderSummaryList } from '../OrderSummaryList'
import type { OrderSummaryRow } from '../OrderSummaryList'
import { OrderSuccessOverlay } from '../OrderSuccessOverlay'
import { useAssetQuery } from '../../../features/market/useAssetQuery'
import { usePlaceOrderMutation } from '../../../features/market/usePlaceOrderMutation'
import { usePurchaseFixedIncomeMutation } from '../../../features/market/usePurchaseFixedIncomeMutation'
import { useRedeemFixedIncomeMutation } from '../../../features/market/useRedeemFixedIncomeMutation'
import { useMyAccountQuery } from '../../../features/portfolio/useMyAccountQuery'
import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
import { ApiError } from '../../../services/client'
import type { OrderConfirmationDialogProps, OrderDraft } from './types'
import styles from './index.module.css'

export type {
    OrderConfirmationDialogProps,
    OrderDraft,
    OrderDraftOrder,
    OrderDraftFixedIncomePurchase,
    OrderDraftFixedIncomeRedemption,
} from './types'

const SIDE_LABEL = { buy: 'Comprar', sell: 'Vender' } as const
const VERB_LABEL = { buy: 'comprou', sell: 'vendeu' } as const

// Confirmação de ordem (tela 4.7, âncora — mockup vivo em identidade-
// visual-padroes.md §0/§7) — overlay (bottom sheet mobile/tablet, modal
// central desktop) sobre a própria tela de origem (4.3/4.5), nunca uma
// rota própria: fechar (backdrop/Esc/Cancelar) volta pro estado exato de
// onde o usuário veio, sem navegação. Único ponto do fluxo que executa de
// verdade (backlog 6.5): `POST /market/orders` (compra/venda de renda
// variável), `POST /market/fixed-income/purchases` (aporte) ou
// `POST /market/fixed-income/redemptions` (resgate), conforme `kind`.
export function OrderConfirmationDialog({ draft, onClose }: OrderConfirmationDialogProps) {
    const navigate = useNavigate()
    const [step, setStep] = useState<'confirm' | 'success'>('confirm')
    const [error, setError] = useState<string | null>(null)

    const accountQuery = useMyAccountQuery()
    // Só a variação de ordem de renda variável precisa reconsultar o preço
    // corrente no momento da confirmação (backlog 6.5: "preço mudou entre
    // simulação e confirmação... reconsulta GET /market/assets/:id... sem
    // re-simular do zero") — as duas variações de renda fixa não têm esse
    // risco (aporte é por valor, resgate já marca a mercado no motor).
    // `refetch` explícito porque a tela de origem (4.5) já populou o cache
    // desse mesmo `queryKey` com um preço potencialmente desatualizado.
    const assetQuery = useAssetQuery(draft.assetId, { enabled: draft.kind === 'order' })
    const placeOrder = usePlaceOrderMutation()
    const purchaseFixedIncome = usePurchaseFixedIncomeMutation()
    const redeemFixedIncome = useRedeemFixedIncomeMutation()

    const isSubmitting = placeOrder.isPending || purchaseFixedIncome.isPending || redeemFixedIncome.isPending

    useEffect(() => {
        if (draft.kind === 'order') void assetQuery.refetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft.assetId])

    useEffect(() => {
        function handleKeydown(event: KeyboardEvent) {
            if (event.key === 'Escape' && !isSubmitting) onClose()
        }
        document.addEventListener('keydown', handleKeydown)
        return () => document.removeEventListener('keydown', handleKeydown)
    }, [isSubmitting, onClose])

    const cashBalance = accountQuery.data?.cashBalance

    const handleConfirm = async () => {
        setError(null)
        try {
            if (draft.kind === 'order') {
                await placeOrder.mutateAsync({ asset_id: draft.assetId, side: draft.side, type: 'market', quantity: draft.quantity })
                setStep('success')
            } else if (draft.kind === 'fixed_income_purchase') {
                await purchaseFixedIncome.mutateAsync({ asset_id: draft.assetId, amount: draft.amount })
                setStep('success')
            } else {
                await redeemFixedIncome.mutateAsync({ asset_id: draft.assetId })
                setStep('success')
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a operação agora.')
        }
    }

    function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
    }

    if (step === 'success') {
        return (
            <div className={styles.backdrop} onMouseDown={handleBackdropClick}>
                <div className={styles.panel} role="dialog" aria-modal="true">
                    <OrderSuccessOverlay
                        message={successMessage(draft, placeOrder.data, purchaseFixedIncome.data, redeemFixedIncome.data)}
                        continueLabel="Voltar pro Portfólio"
                        onContinue={() => navigate('/', { replace: true })}
                    />
                </div>
            </div>
        )
    }

    const currentPrice = draft.kind === 'order' ? (assetQuery.data?.asset.current_price ?? draft.unitPrice) : undefined
    const rows = buildRows(draft, currentPrice, cashBalance)

    return (
        <div className={styles.backdrop} onMouseDown={handleBackdropClick}>
            <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="order-confirmation-title">
                <h1 id="order-confirmation-title" className={styles.title}>
                    Confirmar ordem
                </h1>

                <OrderSummaryList rows={rows} />

                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                <div className={styles.actions}>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void handleConfirm()} disabled={isSubmitting}>
                        Confirmar{' '}
                        {draft.kind === 'order' ? SIDE_LABEL[draft.side] : draft.kind === 'fixed_income_purchase' ? 'aporte' : 'resgate'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

function buildRows(draft: OrderDraft, currentPrice: number | undefined, cashBalance: number | undefined): OrderSummaryRow[] {
    if (draft.kind === 'order') {
        const unit = currentPrice ?? draft.unitPrice
        const total = unit * draft.quantity
        const rows: OrderSummaryRow[] = [
            { label: 'Ativo', value: `${draft.ticker} · ${draft.name}` },
            { label: 'Operação', value: SIDE_LABEL[draft.side] },
            { label: 'Quantidade', value: `${draft.quantity}` },
            { label: 'Preço unitário', value: formatCurrency(unit) },
            { label: 'Total', value: formatCurrency(total), variant: 'total' },
        ]
        if (cashBalance !== undefined) {
            const remaining = draft.side === 'buy' ? cashBalance - total : cashBalance + total
            rows.push({ label: 'Saldo em caixa após a ordem', value: formatCurrency(remaining), variant: 'muted' })
        }
        return rows
    }

    if (draft.kind === 'fixed_income_purchase') {
        const rows: OrderSummaryRow[] = [
            { label: 'Produto', value: `${draft.ticker} · ${draft.name}` },
            { label: 'Valor do aporte', value: formatCurrency(draft.amount) },
        ]
        if (draft.projected) {
            rows.push({ label: 'Alíquota de IR projetada', value: formatPercentage(draft.projected.tax_rate) })
            rows.push({ label: 'Valor líquido projetado', value: formatCurrency(draft.projected.net_projected_value), variant: 'total' })
        }
        if (cashBalance !== undefined) {
            rows.push({ label: 'Saldo em caixa após o aporte', value: formatCurrency(cashBalance - draft.amount), variant: 'muted' })
        }
        return rows
    }

    return [
        { label: 'Produto', value: `${draft.ticker} · ${draft.name}` },
        { label: 'Operação', value: 'Resgate integral da posição' },
        { label: 'Valor', value: 'Calculado no momento da confirmação (marcação a mercado)', variant: 'muted' },
    ]
}

function successMessage(
    draft: OrderDraft,
    orderResult: ReturnType<typeof usePlaceOrderMutation>['data'],
    purchaseResult: ReturnType<typeof usePurchaseFixedIncomeMutation>['data'],
    redemptionResult: ReturnType<typeof useRedeemFixedIncomeMutation>['data'],
): string {
    if (draft.kind === 'order' && orderResult) {
        return `Você ${VERB_LABEL[draft.side]} ${orderResult.filled_quantity} ${draft.ticker}.`
    }
    if (draft.kind === 'fixed_income_purchase' && purchaseResult) {
        return `Você investiu ${formatCurrency(draft.amount)} em ${draft.ticker}.`
    }
    if (draft.kind === 'fixed_income_redemption' && redemptionResult) {
        return `Você resgatou ${draft.ticker}: ${formatCurrency(redemptionResult.net_value)} líquidos (bruto ${formatCurrency(redemptionResult.total_value)}).`
    }
    return 'Operação concluída.'
}
