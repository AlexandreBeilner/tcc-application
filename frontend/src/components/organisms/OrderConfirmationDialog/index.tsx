import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../atoms/Button'
import { LockedAssetPanel } from '../../molecules/LockedAssetPanel'
import { OrderSummaryList } from '../OrderSummaryList'
import type { OrderSummaryRow } from '../OrderSummaryList'
import { OrderSuccessOverlay } from '../OrderSuccessOverlay'
import { useAssetQuery } from '../../../features/market/useAssetQuery'
import { useAssetBookQuery } from '../../../features/market/useAssetBookQuery'
import { usePlaceOrderMutation } from '../../../features/market/usePlaceOrderMutation'
import { asProductLockedError } from '../../../features/market/productLockedError'
import { formatApiError } from '../../../utils/formatApiError'
import { classifyOrderRejection, describeOrderRejection } from '../../../features/market/orderRejection'
import { averageFillPrice } from '../../../features/market/orderBook'
import type { ProductLockedErrorBody } from '../../../services/market'
import { usePurchaseFixedIncomeMutation } from '../../../features/market/usePurchaseFixedIncomeMutation'
import { useRedeemFixedIncomeMutation } from '../../../features/market/useRedeemFixedIncomeMutation'
import { useMyAccountQuery } from '../../../features/portfolio/useMyAccountQuery'
import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
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
const PARTICIPLE_LABEL = { buy: 'comprada', sell: 'vendida' } as const

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
    const [lockedError, setLockedError] = useState<ProductLockedErrorBody | null>(null)

    const accountQuery = useMyAccountQuery()
    // Só a variação de ordem de renda variável precisa reconsultar o preço
    // corrente no momento da confirmação (backlog 6.5: "preço mudou entre
    // simulação e confirmação... reconsulta GET /market/assets/:id... sem
    // re-simular do zero") — as duas variações de renda fixa não têm esse
    // risco (aporte é por valor, resgate já marca a mercado no motor).
    // `refetch` explícito porque a tela de origem (4.5) já populou o cache
    // desse mesmo `queryKey` com um preço potencialmente desatualizado.
    const assetQuery = useAssetQuery(draft.assetId, { enabled: draft.kind === 'order' })
    // Book do ativo (tarefa S.5/S.7) — insumo da mensagem clara de 422 de
    // saldo insuficiente (achado 021: "comprar o máximo" pelo último preço
    // caía em erro genérico), calculada pela mesma profundidade real do
    // painel "Nova ordem".
    const bookQuery = useAssetBookQuery(draft.assetId, { enabled: draft.kind === 'order' })
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
    const ownedQuantity =
        draft.kind === 'order' ? accountQuery.data?.positions.find((position) => position.assetId === draft.assetId)?.quantity : undefined

    const handleConfirm = async () => {
        setError(null)
        setLockedError(null)
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
            // Trava só descoberta na confirmação (tarefa J.3, ex: acesso
            // direto por URL) mostra o mesmo banner amigável de `AssetDetail`
            // em vez do erro genérico — `ProductLockedError` foge da
            // convenção `{ error }` do resto do módulo (`.docs/backend/market.md`).
            const locked = asProductLockedError(err)
            if (locked) {
                setLockedError(locked)
                return
            }
            // Achado 021 (`pontos-em-aberto-decisao-produto.md`)/tarefa S.7:
            // "saldo insuficiente"/"posição insuficiente" genérico do motor
            // ganha a quantidade máxima real (calculada pela mesma
            // profundidade do book do painel "Nova ordem", ou pela posição
            // em carteira do lado da venda) em vez do texto cru do motor.
            const rejection = draft.kind === 'order' ? classifyOrderRejection(err) : null
            if (rejection) {
                setError(describeOrderRejection(rejection, draft.ticker, bookQuery.data?.book, cashBalance, ownedQuantity))
                return
            }
            setError(formatApiError(err, 'Não foi possível concluir a operação agora.'))
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

    // Trava só descoberta na confirmação (Fase Q, reversão da J.3: ex.
    // acesso direto por URL) vira parede total do próprio diálogo — nada de
    // resumo da ordem/ações de confirmar, só o card explicando o que falta
    // pra liberar + um jeito de fechar.
    if (lockedError) {
        return (
            <div className={styles.backdrop} onMouseDown={handleBackdropClick}>
                <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="order-confirmation-title">
                    <h1 id="order-confirmation-title" className={styles.title}>
                        Confirmar ordem
                    </h1>

                    <LockedAssetPanel lessonTitle={lockedError.unlockingLesson?.title} />

                    <div className={styles.actions}>
                        <Button variant="secondary" onClick={onClose}>
                            Fechar
                        </Button>
                    </div>
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
        const { filled_quantity: filled, remaining_quantity: remaining, fills } = orderResult
        // Tarefa A.2 (backlog-motor-mercado-realista): ordem a mercado do
        // Mercado Ao Vivo pode não achar contraparte real suficiente — sem
        // preenchimento sintético, `remaining_quantity` reporta a sobra não
        // executada. Mensagem clara em vez de só citar `filled_quantity`
        // (que já refletia a quantidade real desde antes desta tarefa, mas
        // sem explicar por que ficou menor que o pedido).
        if (remaining > 0 && filled === 0) {
            return `Não havia liquidez suficiente pra negociar ${draft.ticker} agora. Nenhuma unidade foi ${PARTICIPLE_LABEL[draft.side]}. Tente novamente mais tarde.`
        }
        // Tarefa S.7 (achado 021): preço médio executado, não o preço
        // unitário estático de antes da confirmação — a ordem a mercado
        // executa contra o book (spread), nunca exatamente no último negócio.
        const avgPrice = averageFillPrice(fills)
        const priceSuffix = avgPrice !== null ? ` a preço médio de ${formatCurrency(avgPrice)}` : ''
        if (remaining > 0) {
            return `Você ${VERB_LABEL[draft.side]} ${filled} de ${draft.quantity} ${draft.ticker}${priceSuffix}. O restante não achou liquidez suficiente e não foi executado.`
        }
        return `Você ${VERB_LABEL[draft.side]} ${filled} ${draft.ticker}${priceSuffix}.`
    }
    if (draft.kind === 'fixed_income_purchase' && purchaseResult) {
        return `Você investiu ${formatCurrency(draft.amount)} em ${draft.ticker}.`
    }
    if (draft.kind === 'fixed_income_redemption' && redemptionResult) {
        return `Você resgatou ${draft.ticker}: ${formatCurrency(redemptionResult.net_value)} líquidos (bruto ${formatCurrency(redemptionResult.total_value)}).`
    }
    return 'Operação concluída.'
}
