import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    categoryLabel,
    DAILY_ORIGIN_LABELS,
    describeDailyError,
    formatGameDate,
    formatNumbers,
    tallyShare,
} from '../../../features/admin/dailyAdmin'
import { usePublishDailyPuzzlesMutation } from '../../../features/admin/useAdminDaily'
import type { DailyAgendaDay, DailyTally } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import type { AdminDailyAgendaProps } from './types'
import styles from './index.module.css'

export type { AdminDailyAgendaProps } from './types'

function stateBadges(day: DailyAgendaDay) {
    const manual = Object.values(day.origins).some((origin) => origin === 'manual')
    return (
        <span className={styles.badges}>
            <span className={day.reviewed ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                {day.reviewed ? 'Revisado' : 'Sem revisão'}
            </span>
            <span className={day.published ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                {day.published ? 'Publicado' : 'Fora do ar'}
            </span>
            {manual && <span className={`${styles.badge} ${styles.dashed}`}>{DAILY_ORIGIN_LABELS.manual}</span>}
        </span>
    )
}

function CoverageCard({ title, tally }: { title: string; tally: DailyTally }) {
    const entries = Object.entries(tally.by_category).sort((a, b) => b[1] - a[1])
    const max = Math.max(1, ...entries.map(([, count]) => count))
    return (
        <div className={styles.coverageCard}>
            <h3 className={styles.coverageTitle}>{title}</h3>
            <p className={styles.coverageLine}>
                Brasil {tally.brasil} ({tallyShare(tally, 'brasil')}) · Fora {tally.fora} ({tallyShare(tally, 'fora')})
            </p>
            <ul className={styles.bars}>
                {entries.map(([category, count]) => (
                    <li key={category} className={styles.bar}>
                        <span className={styles.barLabel}>{categoryLabel(category)}</span>
                        <span className={styles.barTrack} aria-hidden="true">
                            <span className={styles.barFill} style={{ width: `${(count / max) * 100}%` }} />
                        </span>
                        <span className={styles.barCount}>{count}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

// Agenda dos próximos dias (DI.5.1): cada jogo com o que cada cartão traz, o estado (revisado,
// publicado, trocado à mão) e a cobertura por categoria e marcador Brasil/fora da janela de 30 dias
// (seção 3.3). Tabela no tablet em diante, cartões no mobile.
export function AdminDailyAgenda({ overview }: AdminDailyAgendaProps) {
    const { days, coverage } = overview
    const publish = usePublishDailyPuzzlesMutation()
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const pendingPublish = days.filter((day) => day.reviewed && !day.published).length

    function publishReviewed() {
        publish.mutate(undefined, {
            onSuccess: (result) => {
                setError(null)
                setNotice(result.published.length === 0 ? 'Nada novo para publicar.' : `Publicados: ${formatNumbers(result.published)}.`)
            },
            onError: (err) => {
                setNotice(null)
                setError(describeDailyError(err).message)
            },
        })
    }

    return (
        <section className={styles.root} aria-label="Agenda do Diário">
            <div className={styles.head}>
                <h2 className={styles.title}>Agenda</h2>
                <Button variant="secondary" disabled={publish.isPending || pendingPublish === 0} onClick={publishReviewed}>
                    {publish.isPending ? 'Publicando…' : `Publicar revisados (${pendingPublish})`}
                </Button>
            </div>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            {days.length === 0 ? (
                <p className={styles.muted}>Nenhum jogo na agenda. Informe a data de estreia e prepare o rascunho.</p>
            ) : (
                <>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {['Jogo', 'Palavra', 'Pergunta', 'Linha do tempo', 'Estado', ''].map((header, index) => (
                                    <th key={index} className={styles.th}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map((day) => (
                                <tr key={day.number} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.name}>#{day.number}</div>
                                        <div className={styles.sub}>{formatGameDate(day.date)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        {day.word ? (
                                            <>
                                                <div>{day.word.display}</div>
                                                <div className={styles.sub}>
                                                    {categoryLabel(day.word.category)} · {day.word.scope === 'brasil' ? 'Brasil' : 'Fora'}
                                                </div>
                                            </>
                                        ) : (
                                            'sem palavra'
                                        )}
                                    </td>
                                    <td className={styles.td}>
                                        {day.question ? (
                                            <>
                                                <div className={styles.clamp}>{day.question.text}</div>
                                                <div className={styles.sub}>
                                                    {categoryLabel(day.question.category)} ·{' '}
                                                    {day.question.scope === 'brasil' ? 'Brasil' : 'Fora'}
                                                </div>
                                            </>
                                        ) : (
                                            'sem pergunta'
                                        )}
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.clamp}>{day.events.map((event) => event.label).join(', ')}</div>
                                    </td>
                                    <td className={styles.td}>{stateBadges(day)}</td>
                                    <td className={styles.td}>
                                        <Link to={`/admin/diario/jogo/${day.number}`} className={styles.link}>
                                            Abrir
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <ul className={styles.cards}>
                        {days.map((day) => (
                            <li key={day.number} className={styles.card}>
                                <div className={styles.cardHead}>
                                    <span className={styles.name}>
                                        #{day.number} · {formatGameDate(day.date)}
                                    </span>
                                    <Link to={`/admin/diario/jogo/${day.number}`} className={styles.link}>
                                        Abrir
                                    </Link>
                                </div>
                                <div className={styles.sub}>Palavra: {day.word?.display ?? 'sem palavra'}</div>
                                <div className={styles.sub}>Pergunta: {day.question?.text ?? 'sem pergunta'}</div>
                                {stateBadges(day)}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <div className={styles.coverage}>
                <h2 className={styles.title}>Cobertura dos próximos {coverage.window_days} dias</h2>
                <p className={styles.muted}>
                    A maioria do conteúdo de cada semana deve ser sobre o Brasil. A Linha do tempo conta eventos, não dias.
                </p>
                <div className={styles.coverageGrid}>
                    <CoverageCard title="Palavra do dia" tally={coverage.word} />
                    <CoverageCard title="Pergunta do dia" tally={coverage.trivia} />
                    <CoverageCard title="Eventos da Linha do tempo" tally={coverage.timeline} />
                </div>
            </div>
        </section>
    )
}
