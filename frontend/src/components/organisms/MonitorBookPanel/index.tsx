import { formatCurrency } from '../../../features/portfolio/format'
import type { MonitorBookLevel } from '../../../services/admin'
import type { MonitorBookPanelProps } from './types'
import styles from './index.module.css'

export type { MonitorBookPanelProps } from './types'

const integerFormatter = new Intl.NumberFormat('pt-BR')

function Levels({ title, levels, empty }: { title: string; levels: MonitorBookLevel[]; empty: string }) {
    return (
        <section className={styles.side} aria-label={title}>
            <h3 className={styles.sideTitle}>{title}</h3>
            {levels.length === 0 ? (
                <p className={styles.empty}>{empty}</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Preço</th>
                            <th>Quantidade</th>
                            <th>De bots</th>
                        </tr>
                    </thead>
                    <tbody>
                        {levels.map((level) => (
                            <tr key={level.price}>
                                <td>{formatCurrency(level.price)}</td>
                                <td>{integerFormatter.format(level.quantity)}</td>
                                <td>{integerFormatter.format(level.bot_quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    )
}

// Book completo do ativo e últimos negócios (N.8). Mostra só quantidade agregada por
// preço e quanto dela é de bot: nunca o dono de uma ordem individual.
export function MonitorBookPanel({ asks, bids, trades }: MonitorBookPanelProps) {
    return (
        <div className={styles.panel}>
            <div className={styles.book}>
                <Levels title="Ordens de venda" levels={asks} empty="Ninguém vendendo agora." />
                <Levels title="Ordens de compra" levels={bids} empty="Ninguém comprando agora." />
            </div>

            <section className={styles.side} aria-label="Últimos negócios">
                <h3 className={styles.sideTitle}>Últimos negócios</h3>
                {trades.length === 0 ? (
                    <p className={styles.empty}>Nenhum negócio ainda.</p>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Dia simulado</th>
                                <th>Preço</th>
                                <th>Quantidade</th>
                                <th>Comprador</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((trade, index) => (
                                <tr key={`${trade.simulated_day}-${index}`}>
                                    <td>{trade.simulated_day}</td>
                                    <td>{formatCurrency(trade.price)}</td>
                                    <td>{integerFormatter.format(trade.quantity)}</td>
                                    <td>{trade.buyer_is_bot ? 'Bot' : 'Usuário'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    )
}
