import { Button } from '../../atoms/Button'
import { OrderSummaryList } from '../OrderSummaryList'
import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
import type { FixedIncomeSimulatorProps } from './types'
import styles from './index.module.css'

export type { FixedIncomeSimulatorProps } from './types'

// Simulador de aporte da tela 4.3 (inventário: "campo de valor → projeção
// de retorno até o vencimento") — usa só `GET /market/fixed-income/
// simulate` (6.0.5), nunca `POST .../purchases` pra simular (backlog 6.5).
// Valor abaixo da aplicação mínima bloqueia o botão preventivamente
// (estado especial documentado no backlog), não só trata o erro 422.
export function FixedIncomeSimulator({ minimumInvestment, amount, onAmountChange, simulation, onInvest }: FixedIncomeSimulatorProps) {
    const isBelowMinimum = amount > 0 && amount < minimumInvestment

    return (
        <div className={styles.simulator}>
            <span className={styles.title}>Simular aporte</span>

            <label className={styles.field}>
                Valor do aporte
                <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount || ''}
                    onChange={(event) => onAmountChange(Number(event.target.value))}
                />
            </label>

            <p className={styles.minimum}>Aplicação mínima: {formatCurrency(minimumInvestment)}</p>

            {isBelowMinimum && (
                <p className={styles.warning} role="alert">
                    O valor informado está abaixo da aplicação mínima deste produto.
                </p>
            )}

            {simulation && !isBelowMinimum && (
                <OrderSummaryList
                    rows={[
                        { label: 'Valor bruto projetado', value: formatCurrency(simulation.gross_projected_value) },
                        { label: 'Alíquota de IR', value: formatPercentage(simulation.tax_rate) },
                        { label: 'Valor líquido projetado', value: formatCurrency(simulation.net_projected_value), variant: 'total' },
                    ]}
                />
            )}

            <Button fullWidth disabled={amount <= 0 || isBelowMinimum} onClick={onInvest}>
                Investir
            </Button>
        </div>
    )
}
