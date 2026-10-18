import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useFirstActionPurchase } from '../../../features/onboarding/useFirstActionPurchase'
import { formatCurrency } from '../../../features/portfolio/format'
import { Button } from '../../atoms/Button'
import type { FirstActionOutcome, FirstActionStepProps } from './types'
import styles from './index.module.css'

export type { FirstActionOutcome, FirstActionStepProps } from './types'

const PHASES = [{ label: 'O que você vai comprar' }, { label: 'Preço e quantidade' }, { label: 'Confirmar' }] as const

// Passo "Aprenda fazendo" do onboarding (OB.1.2, OP1): três toques para a primeira compra, no Modo
// Aprendizado, com cada termo definido antes de aparecer. Erro na compra nunca trava o onboarding: a
// mensagem aparece e quem chama segue (`onSettled('failed')`).
export function FirstActionStep({ onSettled }: FirstActionStepProps) {
    const purchase = useFirstActionPurchase()
    const [phase, setPhase] = useState(0)
    const [outcome, setOutcome] = useState<FirstActionOutcome | null>(null)

    async function handleBuy() {
        try {
            await purchase.buy()
            setOutcome('bought')
            onSettled('bought')
        } catch {
            setOutcome('failed')
            onSettled('failed')
        }
    }

    if (outcome === 'bought') {
        return (
            <div className={styles.step}>
                <p className={styles.done} role="status">
                    <CheckCircle2 size={20} aria-hidden="true" />
                    Primeira ação comprada!
                </p>
                <p className={styles.note}>Aqui o tempo passa mais rápido. Volte amanhã para ver como foi a sua primeira ação.</p>
            </div>
        )
    }

    if (outcome === 'failed' || purchase.isUnavailable) {
        return (
            <p className={styles.problem} role="alert">
                {outcome === 'failed'
                    ? 'Não conseguimos fazer a compra agora. Sem problema: você segue o passo a passo e pode tentar de novo depois.'
                    : 'O Modo Aprendizado não está disponível agora. Sem problema: você pode fazer esta compra depois.'}
            </p>
        )
    }

    if (purchase.isLoading || purchase.unitPrice === undefined) {
        return <p className={styles.note}>Preparando a sua compra de treino…</p>
    }

    const total = purchase.unitPrice * purchase.quantity

    return (
        <div className={styles.step}>
            <p className={styles.counter}>
                Passo {phase + 1} de {PHASES.length}: {PHASES[phase].label}
            </p>

            {phase === 0 && (
                <p className={styles.explain}>
                    Uma ação é um pedacinho de uma empresa. A de treino se chama {purchase.assetName}, e o código curto dela, o ticker, é{' '}
                    <b>{purchase.ticker}</b>.
                </p>
            )}
            {phase === 1 && (
                <dl className={styles.facts}>
                    <div>
                        <dt>Preço</dt>
                        <dd className="tabular-nums">{formatCurrency(purchase.unitPrice)}</dd>
                        <dd className={styles.hint}>quanto custa cada ação</dd>
                    </div>
                    <div>
                        <dt>Quantidade</dt>
                        <dd className="tabular-nums">{purchase.quantity}</dd>
                        <dd className={styles.hint}>quantas ações você leva</dd>
                    </div>
                </dl>
            )}
            {phase === 2 && (
                <div className={styles.explain}>
                    <p className={styles.total}>
                        Total: <b className="tabular-nums">{formatCurrency(total)}</b>
                    </p>
                    <p>
                        É o preço vezes a quantidade. É dinheiro de treino: não sai do seu saldo do mercado ao vivo e não conta pro ranking.
                    </p>
                </div>
            )}

            {phase < PHASES.length - 1 ? (
                <Button onClick={() => setPhase((current) => current + 1)}>Próximo passo</Button>
            ) : (
                <Button onClick={() => void handleBuy()} disabled={purchase.isBuying}>
                    {purchase.isBuying ? 'Comprando…' : `Comprar ${purchase.quantity} ações`}
                </Button>
            )}
        </div>
    )
}
