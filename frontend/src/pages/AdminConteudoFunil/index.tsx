import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
    barPercent,
    cardLabel,
    DEFAULT_FUNNEL_WINDOW,
    FUNNEL_WINDOWS,
    isBiggestDrop,
    summarizeFunnel,
} from '../../features/admin/cardFunnel'
import { formatRate } from '../../features/admin/lessonCatalog'
import { useLessonCardFunnelQuery } from '../../features/admin/useAdminLessons'
import styles from './index.module.css'

// Funil por cartão de uma lição (LJ.5.1): `/admin/conteudo/:id/funil`. Mostra quantas pessoas chegaram a cada
// cartão do player e destaca onde mais gente para, pra decidir qual cartão encurtar e medir se uma mudança
// funcionou. Só contagem, sem usuário. Mobile: uma coluna com a barra sob o nome do cartão; desktop: barras à
// esquerda e o resumo fixo à direita.
export function AdminConteudoFunil() {
    const { id } = useParams<{ id: string }>()
    const lessonId = id as string
    const [days, setDays] = useState<number>(DEFAULT_FUNNEL_WINDOW)
    const query = useLessonCardFunnelQuery(lessonId, days)
    const funnel = query.data

    const max = funnel ? Math.max(...funnel.bars.map((bar) => bar.reached), 0) : 0

    return (
        <main className={styles.page}>
            <Link to="/admin/conteudo" className={styles.back}>
                Voltar para Conteúdo
            </Link>

            <header className={styles.header}>
                <h1 className={styles.title}>Funil por cartão{funnel ? `: ${funnel.lesson.code} · ${funnel.lesson.title}` : ''}</h1>
                <p className={styles.subtitle}>
                    Quantas pessoas chegaram a cada cartão da lição. Quem retoma a lição no meio entra a partir de onde parou, e depois de
                    editar o texto os cartões mudam de posição: prefira uma janela curta.
                </p>
            </header>

            <div className={styles.windows} role="group" aria-label="Janela de dias">
                {FUNNEL_WINDOWS.map((option) => (
                    <button
                        key={option}
                        type="button"
                        className={`${styles.windowButton} ${option === days ? styles.windowActive : ''}`}
                        aria-pressed={option === days}
                        onClick={() => setDays(option)}
                    >
                        {option} dias
                    </button>
                ))}
            </div>

            {query.isLoading && <p className={styles.muted}>Carregando funil…</p>}
            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o funil desta lição. Ela pode não existir.
                </p>
            )}

            {funnel && (
                <div className={styles.layout}>
                    <ol className={styles.bars} aria-label="Cartões da lição">
                        {funnel.bars.map((bar) => {
                            const worst = isBiggestDrop(funnel, bar)
                            return (
                                <li key={`${bar.phase}:${bar.card_index}`} className={`${styles.row} ${worst ? styles.worst : ''}`}>
                                    <span className={styles.label}>
                                        {cardLabel(bar)}
                                        {worst && <span className={styles.badge}>Maior queda</span>}
                                    </span>
                                    <span className={styles.track} aria-hidden="true">
                                        <span className={styles.fill} style={{ width: `${barPercent(bar.reached, max)}%` }} />
                                    </span>
                                    <span className={styles.count}>
                                        {bar.reached} {bar.reached === 1 ? 'pessoa' : 'pessoas'}
                                        {bar.lost > 0 && (
                                            <span className={styles.lost}>
                                                {' '}
                                                (-{bar.lost}, {formatRate(bar.lost_rate)})
                                            </span>
                                        )}
                                    </span>
                                </li>
                            )
                        })}
                    </ol>

                    <aside className={styles.summary} aria-label="Resumo">
                        <h2 className={styles.summaryTitle}>Resumo</h2>
                        <p className={styles.summaryText}>{summarizeFunnel(funnel)}</p>
                        <p className={styles.muted}>
                            Janela: últimos {funnel.days} {funnel.days === 1 ? 'dia' : 'dias'}, desde {funnel.since}.
                        </p>
                    </aside>
                </div>
            )}
            {funnel && funnel.bars.length === 0 && <p className={styles.muted}>Nada medido ainda nesta janela.</p>}
        </main>
    )
}
