import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { OrderSummaryList } from '../../components/organisms/OrderSummaryList'
import type { OrderSummaryRow } from '../../components/organisms/OrderSummaryList'
import { OrderSuccessOverlay } from '../../components/organisms/OrderSuccessOverlay'
import { useAssetQuery } from '../../features/market/useAssetQuery'
import { usePlaceOrderMutation } from '../../features/market/usePlaceOrderMutation'
import { usePurchaseFixedIncomeMutation } from '../../features/market/usePurchaseFixedIncomeMutation'
import { useRedeemFixedIncomeMutation } from '../../features/market/useRedeemFixedIncomeMutation'
import { useMyAccountQuery } from '../../features/portfolio/useMyAccountQuery'
import { formatCurrency, formatPercentage } from '../../features/portfolio/format'
import { ApiError } from '../../services/client'
import type { OrderDraft } from './types'
import styles from './index.module.css'

const SIDE_LABEL = { buy: 'Comprar', sell: 'Vender' } as const
const VERB_LABEL = { buy: 'comprou', sell: 'vendeu' } as const

// Tela 4.7 (âncora, mockup vivo em identidade-visual-padroes.md §0) — passo
// explícito de confirmação antes de qualquer execução real, alcançado só
// por navegação com `state` (nunca refeito a partir de uma URL/id sozinho
// — sem o rascunho da ordem, redireciona pro hub). Único ponto do fluxo
// que executa de verdade (backlog 6.5): `POST /market/orders` (compra/
// venda de renda variável), `POST /market/fixed-income/purchases` (aporte)
// ou `POST /market/fixed-income/redemptions` (resgate), conforme `kind`.
export function OrderConfirmation() {
    const location = useLocation()
    const navigate = useNavigate()
    const draft = location.state as OrderDraft | undefined

    const [step, setStep] = useState<'confirm' | 'success'>('confirm')
    const [error, setError] = useState<string | null>(null)

    const accountQuery = useMyAccountQuery()
    // Só a variação de ordem de renda variável precisa reconsultar o preço
    // corrente no momento da confirmação (backlog 6.5: "preço mudou entre
    // simulação e confirmação... reconsulta GET /market/assets/:id... sem
    // re-simular do zero") — as duas variações de renda fixa não têm esse
    // risco (aporte é por valor, resgate já marca a mercado no motor).
    const assetQuery = useAssetQuery(draft?.assetId ?? '')
    const placeOrder = usePlaceOrderMutation()
    const purchaseFixedIncome = usePurchaseFixedIncomeMutation()
    const redeemFixedIncome = useRedeemFixedIncomeMutation()

    useEffect(() => {
        if (draft?.kind === 'order') void assetQuery.refetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft?.assetId])

    if (!draft) {
        return <Navigate to="/mercado" replace />
    }

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

    if (step === 'success') {
        return (
            <main className={styles.page}>
                <div className={styles.panel}>
                    <OrderSuccessOverlay
                        message={successMessage(draft, placeOrder.data, purchaseFixedIncome.data, redeemFixedIncome.data)}
                        continueLabel="Voltar pro Portfólio"
                        onContinue={() => navigate('/', { replace: true })}
                    />
                </div>
            </main>
        )
    }

    const currentPrice = draft.kind === 'order' ? (assetQuery.data?.asset.current_price ?? draft.unitPrice) : undefined
    const rows = buildRows(draft, currentPrice, cashBalance)
    const isSubmitting = placeOrder.isPending || purchaseFixedIncome.isPending || redeemFixedIncome.isPending

    return (
        <main className={styles.page}>
            <div className={styles.panel}>
                <h1 className={styles.title}>Confirmar ordem</h1>

                <OrderSummaryList rows={rows} />

                {error && (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                )}

                <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void handleConfirm()} disabled={isSubmitting}>
                        Confirmar{' '}
                        {draft.kind === 'order' ? SIDE_LABEL[draft.side] : draft.kind === 'fixed_income_purchase' ? 'aporte' : 'resgate'}
                    </Button>
                </div>
            </div>
        </main>
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
