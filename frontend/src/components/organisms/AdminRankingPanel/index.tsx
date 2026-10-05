import { useState } from 'react'
import {
    formatRankingPct,
    formatWindowRange,
    RANKING_CRITERION_LABELS,
    RANKING_WINDOW_LABELS,
} from '../../../features/admin/gamificationCatalog'
import { useAdminRankingQuery } from '../../../features/admin/useGamificationCatalog'
import type { AdminRankingCriterion, AdminRankingEntry, AdminRankingWindow } from '../../../services/admin'
import type { AdminRankingPanelProps } from './types'
import styles from './index.module.css'

const WINDOWS = Object.keys(RANKING_WINDOW_LABELS) as AdminRankingWindow[]
const CRITERIA = Object.keys(RANKING_CRITERION_LABELS) as AdminRankingCriterion[]

export type { AdminRankingPanelProps } from './types'

// Ranking global da janela corrente (N.19), SÓ LEITURA. O ranking é calculado na hora sobre a janela fixa
// (semana ou mês, em UTC), sem estado gravado, então não há janela pra fechar nem recalcular. Mostra só
// nível, XP e rentabilidade percentual: nunca patrimônio absoluto (RNF09), nem pro administrador neste painel.
export function AdminRankingPanel({ active }: AdminRankingPanelProps) {
    const [window, setWindow] = useState<AdminRankingWindow>('week')
    const [criterion, setCriterion] = useState<AdminRankingCriterion>('overall')
    const [page, setPage] = useState(1)

    const rankingQuery = useAdminRankingQuery({ window: criterion === 'level' ? undefined : window, criterion, page }, active)
    const ranking = rankingQuery.data
    const range = ranking ? formatWindowRange(ranking.window_start, ranking.window_end) : null

    const rankingValue = (entry: AdminRankingEntry) =>
        criterion === 'level' ? `${entry.xp} XP` : formatRankingPct(entry.profitability_pct)
    const valueHeader = criterion === 'level' ? 'XP' : 'Rentabilidade'

    return (
        <section className={styles.root} aria-label="Ranking">
            <p className={styles.intro}>
                Leitura do ranking global da janela corrente. Ele é calculado na hora, sem janela gravada, então não há o que fechar ou
                recalcular.
            </p>

            <div className={styles.filters}>
                <label className={styles.field}>
                    <span>Critério</span>
                    <select
                        className={styles.input}
                        value={criterion}
                        onChange={(event) => {
                            setCriterion(event.target.value as AdminRankingCriterion)
                            setPage(1)
                        }}
                    >
                        {CRITERIA.map((key) => (
                            <option key={key} value={key}>
                                {RANKING_CRITERION_LABELS[key]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    <span>Janela</span>
                    <select
                        className={styles.input}
                        value={window}
                        disabled={criterion === 'level'}
                        onChange={(event) => {
                            setWindow(event.target.value as AdminRankingWindow)
                            setPage(1)
                        }}
                    >
                        {WINDOWS.map((key) => (
                            <option key={key} value={key}>
                                {RANKING_WINDOW_LABELS[key]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {criterion === 'level' && <p className={styles.hint}>O nível é cumulativo desde sempre: não usa janela.</p>}
            {range && <p className={styles.hint}>Janela corrente: {range} (UTC).</p>}
            {rankingQuery.isLoading && <p className={styles.muted}>Carregando ranking…</p>}
            {rankingQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o ranking agora.
                </p>
            )}

            {ranking && ranking.entries.length === 0 && <p className={styles.muted}>Ninguém no ranking neste critério ainda.</p>}

            {ranking && ranking.entries.length > 0 && (
                <div className={styles.wrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {['#', 'Usuário', 'Nível', valueHeader].map((header) => (
                                    <th key={header} className={styles.th}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.entries.map((entry) => (
                                <tr key={entry.user_id} className={styles.tr}>
                                    <td className={styles.td}>{entry.position}</td>
                                    <td className={styles.td}>@{entry.username}</td>
                                    <td className={styles.td}>{entry.level}</td>
                                    <td className={styles.td}>{rankingValue(entry)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <ul className={styles.cards}>
                        {ranking.entries.map((entry) => (
                            <li key={entry.user_id} className={styles.card}>
                                <div className={styles.cardRow}>
                                    <span className={styles.name}>
                                        {entry.position}. @{entry.username}
                                    </span>
                                    <span>{rankingValue(entry)}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span className={styles.cardLabel}>Nível</span>
                                    <span>{entry.level}</span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className={styles.pager}>
                        <button
                            type="button"
                            className={styles.link}
                            disabled={ranking.page <= 1}
                            onClick={() => setPage(ranking.page - 1)}
                        >
                            Anterior
                        </button>
                        <span className={styles.muted}>
                            Página {ranking.page} de {Math.max(1, ranking.total_pages)} · {ranking.total_entries} no ranking
                        </span>
                        <button
                            type="button"
                            className={styles.link}
                            disabled={ranking.page >= ranking.total_pages}
                            onClick={() => setPage(ranking.page + 1)}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}
