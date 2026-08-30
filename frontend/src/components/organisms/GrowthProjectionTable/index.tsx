import { formatCurrency } from '../../../features/portfolio/format'
import type { GrowthProjectionTableProps } from './types'
import styles from './index.module.css'

export type { GrowthProjectionTableProps } from './types'

// Tabela mês a mês da tela 6.1 (tarefa 6.7.3, pedido do autor) — abaixo do
// gráfico "total vs. investido", uma linha por mês com o detalhamento que
// o gráfico não mostra: juros do mês (não acumulado), total investido até
// ali, juros acumulados desde o início e o total acumulado do período.
// Período pode chegar a centenas de meses (ex: 30 anos = 360 linhas) — o
// wrapper limita a altura com scroll vertical próprio, não deixa a tabela
// empurrar o resto da tela pra baixo indefinidamente.
export function GrowthProjectionTable({ points }: GrowthProjectionTableProps) {
    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.th}>Mês</th>
                        <th className={styles.th}>Juros do mês</th>
                        <th className={styles.th}>Total investido</th>
                        <th className={styles.th}>Juros acumulados</th>
                        <th className={styles.th}>Total acumulado</th>
                    </tr>
                </thead>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.month} className={styles.tr}>
                            <td className={styles.td}>{point.month}</td>
                            <td className={styles.td}>{formatCurrency(point.interest)}</td>
                            <td className={styles.td}>{formatCurrency(point.invested)}</td>
                            <td className={styles.td}>{formatCurrency(point.total - point.invested)}</td>
                            <td className={styles.td}>{formatCurrency(point.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
