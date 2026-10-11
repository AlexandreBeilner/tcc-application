import { OrderSummaryList } from '../OrderSummaryList'
import { formatCurrency } from '../../../features/portfolio/format'
import type { PositionSummaryCardProps } from './types'
import { Delta } from '../../atoms/Delta'
import styles from './index.module.css'

export type { PositionSummaryCardProps } from './types'

// Card "Sua posição" (tarefa S.16, tela 4.5) — só aparece pra posição real
// de renda variável (nunca sandbox, RF12/RNF08), quem decide isso é
// `AssetDetail` (o card em si só recebe os números já filtrados). Preço
// atual usa o mesmo fallback de marcação a mercado da S.6/S.7
// (`markPrice ?? averagePrice`). O retorno de preço e o retorno total
// (com provento, S.15) aparecem lado a lado de propósito: a diferença
// entre os dois não é inconsistência, é o provento que já caiu em caixa
// separadamente da cotação (mesmo espírito pedagógico do RF21).
export function PositionSummaryCard({ quantity, averagePrice, markPrice, dividendsReceived }: PositionSummaryCardProps) {
    const currentPrice = markPrice ?? averagePrice
    const priceReturn = (currentPrice - averagePrice) / averagePrice
    const totalReturn = ((currentPrice - averagePrice) * quantity + dividendsReceived) / (averagePrice * quantity)

    return (
        <section className={styles.card}>
            <span className={styles.title}>Sua posição</span>

            <OrderSummaryList
                rows={[
                    { label: 'Quantidade', value: String(quantity) },
                    { label: 'Preço médio', value: formatCurrency(averagePrice) },
                    { label: 'Preço atual', value: formatCurrency(currentPrice) },
                    { label: 'Proventos recebidos', value: formatCurrency(dividendsReceived), variant: 'muted' },
                ]}
            />

            <div className={styles.returns}>
                <div className={styles.returnItem}>
                    <span className={styles.returnLabel}>Retorno de preço</span>
                    <Delta percent={priceReturn * 100} className={styles.returnValue} />
                </div>
                <div className={styles.returnItem}>
                    <span className={styles.returnLabel}>Retorno total (com provento)</span>
                    <Delta percent={totalReturn * 100} className={styles.returnValue} />
                </div>
            </div>

            <p className={styles.explanation}>
                O retorno de preço considera só a variação da cotação; o retorno total soma os proventos já recebidos em caixa. A diferença
                entre os dois não é um erro, é dinheiro que você já embolsou.
            </p>
        </section>
    )
}
