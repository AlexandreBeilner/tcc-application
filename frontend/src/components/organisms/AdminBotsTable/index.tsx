import { Link } from 'react-router-dom'
import { describeArchetype, describeScope, shortBotId } from '../../../features/admin/botLabels'
import { formatCurrency } from '../../../features/portfolio/format'
import type { AdminBot } from '../../../services/admin'
import type { AdminBotsTableProps } from './types'
import styles from './index.module.css'

export type { AdminBotsTableProps } from './types'

const integerFormatter = new Intl.NumberFormat('pt-BR')

function holdingsText(bot: AdminBot): string {
    const count = bot.holdings.length
    return count === 0 ? 'Sem posição' : `${integerFormatter.format(count)} ${count === 1 ? 'ativo' : 'ativos'}`
}

function coverageText(bot: AdminBot): string {
    if (bot.max_covered_assets === null) return 'Não se aplica'
    return `${bot.covered_assets.length} de ${bot.max_covered_assets}`
}

function tickers(bot: AdminBot): string {
    return bot.covered_assets.map((asset) => asset.ticker).join(', ')
}

// Bots do motor (N.2): tabela no tablet/desktop e cartões no mobile (nunca tabela com scroll
// horizontal em tela estreita). Estado nunca só por cor: o selo repete o texto, e o bot inativo
// ganha borda tracejada (convenção sólido/tracejado do app). Só o Market Maker mostra "Cobertura".
export function AdminBotsTable({ bots, updatingId, onToggle, onEditCoverage, emptyMessage }: AdminBotsTableProps) {
    if (bots.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

    const identity = (bot: AdminBot) => (
        <>
            <span className={styles.archetype}>{describeArchetype(bot.archetype)}</span>
            <span className={styles.sub}>
                {' '}
                <Link to={`/admin/mercado/ordens?user_id=${bot.account_id}`} className={styles.idLink} title={bot.account_id}>
                    {shortBotId(bot.account_id)}
                </Link>
            </span>
        </>
    )

    const status = (bot: AdminBot) => (
        <span className={`${styles.badge} ${bot.is_active ? '' : styles.dashed}`}>{bot.is_active ? 'Ativo' : 'Inativo'}</span>
    )

    const actions = (bot: AdminBot) => (
        <div className={styles.actions}>
            <button type="button" className={styles.action} disabled={updatingId === bot.account_id} onClick={() => onToggle(bot)}>
                {bot.is_active ? 'Desativar' : 'Ativar'}
            </button>
            {bot.max_covered_assets !== null && (
                <button
                    type="button"
                    className={styles.action}
                    disabled={updatingId === bot.account_id}
                    onClick={() => onEditCoverage(bot)}
                >
                    Cobertura
                </button>
            )}
        </div>
    )

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {['Bot', 'Escopo', 'Caixa', 'Posições', 'Cobertura', 'Status', ''].map((header) => (
                            <th key={header || 'acoes'} className={styles.th}>
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bots.map((bot) => (
                        <tr key={bot.account_id} className={styles.tr}>
                            <td className={styles.td}>{identity(bot)}</td>
                            <td className={styles.td}>{describeScope(bot.scope)}</td>
                            <td className={`${styles.td} tabular-nums`}>{formatCurrency(bot.cash)}</td>
                            <td className={styles.td}>{holdingsText(bot)}</td>
                            <td className={styles.td}>
                                {coverageText(bot)}
                                {bot.covered_assets.length > 0 && <div className={styles.sub}>{tickers(bot)}</div>}
                            </td>
                            <td className={styles.td}>{status(bot)}</td>
                            <td className={styles.td}>{actions(bot)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <ul className={styles.cards}>
                {bots.map((bot) => (
                    <li key={bot.account_id} className={styles.card}>
                        <div className={styles.cardHead}>
                            <span>{identity(bot)}</span>
                            {status(bot)}
                        </div>
                        <p className={styles.cardScope}>{describeScope(bot.scope)}</p>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Caixa</span>
                            <span className="tabular-nums">{formatCurrency(bot.cash)}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Posições</span>
                            <span>{holdingsText(bot)}</span>
                        </div>
                        {bot.max_covered_assets !== null && (
                            <div className={styles.cardRow}>
                                <span className={styles.cardLabel}>Cobertura</span>
                                <span>{coverageText(bot)}</span>
                            </div>
                        )}
                        {bot.covered_assets.length > 0 && <p className={styles.sub}>{tickers(bot)}</p>}
                        {actions(bot)}
                    </li>
                ))}
            </ul>
        </div>
    )
}
