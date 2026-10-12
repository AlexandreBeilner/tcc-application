import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
import type { PositionReturn } from '../../../features/portfolio/positionReturns'
import { Delta } from '../../atoms/Delta'
import type { PositionsListProps } from './types'
import styles from './index.module.css'

export type { PositionsListProps } from './types'

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 })

function toPercent(ratio: number | null): number | null {
    return ratio === null ? null : ratio * 100
}

function unitPrice(row: PositionReturn): number {
    return row.quantity > 0 ? row.currentValue / row.quantity : 0
}

// Renda fixa: o resultado é sobre o valor bruto; o líquido de IR (o que o resgate creditaria) é
// informação secundária. Sem avaliação do motor, o valor atual é só o custo e a linha avisa.
function FixedIncomeNote({ row }: { row: PositionReturn }) {
    if (!row.isFixedIncome) return null
    if (!row.valued) return <span className={styles.note}>Sem avaliação agora</span>
    if (row.netValue === undefined) return null
    return (
        <span className={styles.note}>
            Líquido se resgatar hoje: <span className="tabular-nums">{formatCurrency(row.netValue)}</span>
        </span>
    )
}

function ResultCell({ row }: { row: PositionReturn }) {
    if (!row.valued) return <span className={styles.muted}>—</span>
    return (
        <span className={styles.result}>
            <Delta percent={toPercent(row.resultRatio)} variant="text" />
            <Delta amount={row.resultAmount} variant="text" />
        </span>
    )
}

// "Meus ativos" (MO.8.3): tabela no desktop (>= 1024 px), um cartão por ativo no mobile e tablet,
// nunca tabela com rolagem horizontal. As duas marcações ficam sempre no DOM e a media query
// escolhe (mesma técnica de `AssetTable`). A linha inteira leva à página do ativo.
export function PositionsList({ rows, onSelect }: PositionsListProps) {
    return (
        <div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.th}>Ativo</th>
                        <th className={`${styles.th} ${styles.num}`}>Qtd.</th>
                        <th className={`${styles.th} ${styles.num}`}>Preço médio</th>
                        <th className={`${styles.th} ${styles.num}`}>Preço atual</th>
                        <th className={`${styles.th} ${styles.num}`}>Valor atual</th>
                        <th className={`${styles.th} ${styles.num}`}>Resultado</th>
                        <th className={`${styles.th} ${styles.num}`}>Peso</th>
                        <th className={`${styles.th} ${styles.num}`}>Proventos</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.assetId}
                            className={styles.tr}
                            tabIndex={0}
                            onClick={() => onSelect(row)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') onSelect(row)
                            }}
                        >
                            <td className={styles.td}>
                                <span className={styles.ticker}>{row.ticker}</span>
                                <span className={styles.name}>{row.name}</span>
                                <FixedIncomeNote row={row} />
                            </td>
                            <td className={`${styles.td} ${styles.num} tabular-nums`}>{quantityFormatter.format(row.quantity)}</td>
                            <td className={`${styles.td} ${styles.num} tabular-nums`}>{formatCurrency(row.averagePrice)}</td>
                            <td className={`${styles.td} ${styles.num} tabular-nums`}>
                                {row.valued ? formatCurrency(unitPrice(row)) : '—'}
                            </td>
                            <td className={`${styles.td} ${styles.num} tabular-nums`}>{formatCurrency(row.currentValue)}</td>
                            <td className={`${styles.td} ${styles.num}`}>
                                <ResultCell row={row} />
                            </td>
                            <td className={`${styles.td} ${styles.num} tabular-nums`}>{formatPercentage(row.weight)}</td>
                            <td className={`${styles.td} ${styles.num} tabular-nums`}>
                                {row.isFixedIncome ? '—' : formatCurrency(row.dividendsReceived)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <ul className={styles.cards}>
                {rows.map((row) => (
                    <li key={row.assetId}>
                        <button type="button" className={styles.card} onClick={() => onSelect(row)}>
                            <span className={styles.cardTop}>
                                <span className={styles.cardId}>
                                    <span className={styles.ticker}>{row.ticker}</span>
                                    <span className={styles.name}>{row.name}</span>
                                </span>
                                <span className={`${styles.cardValue} tabular-nums`}>{formatCurrency(row.currentValue)}</span>
                            </span>
                            <span className={styles.cardMid}>
                                <ResultCell row={row} />
                                <span className={`${styles.weight} tabular-nums`}>{formatPercentage(row.weight)} da carteira</span>
                            </span>
                            <span className={`${styles.cardMeta} tabular-nums`}>
                                {row.isFixedIncome
                                    ? `Aplicado ${formatCurrency(row.cost)}`
                                    : `${quantityFormatter.format(row.quantity)} un. · Preço médio ${formatCurrency(row.averagePrice)} · Atual ${formatCurrency(unitPrice(row))}`}
                            </span>
                            <FixedIncomeNote row={row} />
                            {!row.isFixedIncome && row.dividendsReceived > 0 && (
                                <span className={styles.note}>
                                    Proventos: <span className="tabular-nums">{formatCurrency(row.dividendsReceived)}</span>
                                </span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
