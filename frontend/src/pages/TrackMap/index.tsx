import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { groupLessonsByTrack } from '../../features/lessons/trackGroups'
import { TrackPath, statusLabel } from '../../components/organisms/TrackPath'
import { TrackMapLegend } from '../../components/organisms/TrackMapLegend'
import { LessonNode } from '../../components/organisms/LessonNode'
import { TRACKS } from '../../utils/tracks'
import type { Lesson } from '../../services/lessons'
import styles from './index.module.css'

// Tela nova (backlog engajamento O.3, mockup vivo em
// `.claude/backlog-engajamento-gamificacao.md` Fase O/O.0) — mapa vertical
// de uma trilha, aberto a partir de um card do Hub (O.1). Rota própria com
// segmento estático (`mapa`) em vez de reaproveitar `/trilha/:id` (Lição,
// `id` = UUID) — `trackNumber` é um inteiro pequeno (0-3), sem ambiguidade
// de roteamento entre os dois `:param`. `trackNumber` fora do currículo
// (`TRACKS`) redireciona pro Hub, sempre acessível — validação de
// parâmetro de rota, não o mesmo risco da Fase N (que é sobre apontar pra
// uma LIÇÃO bloqueada).
export function TrackMap() {
    const { trackNumber: trackNumberParam } = useParams<{ trackNumber: string }>()
    const trackNumber = Number(trackNumberParam)
    const track = TRACKS.find((candidate) => candidate.number === trackNumber)

    const navigate = useNavigate()
    const lessonsQuery = useLessonsQuery()
    const [expandedHintId, setExpandedHintId] = useState<string | null>(null)

    if (!track) {
        return <Navigate to="/trilha" replace />
    }

    const lessons = lessonsQuery.data?.lessons ?? []
    const group = groupLessonsByTrack(lessons).find((candidate) => candidate.trackNumber === trackNumber)
    const trackLessons = group?.lessons ?? []
    const completedCount = trackLessons.filter((lesson) => lesson.status === 'completed').length
    const completionPct = trackLessons.length === 0 ? 0 : Math.round((completedCount / trackLessons.length) * 100)

    // Mesmo precedente de `Track/index.tsx:36-42` (removido na O.1, nunca
    // reaberto pela Fase N — nó bloqueado nunca navegou, sempre foi o
    // comportamento certo): nó `locked` só expande um aviso inline, nunca
    // navega; `available`/`completed` vão pra Lição de verdade.
    function handleNodeClick(lesson: Lesson) {
        if (lesson.status === 'locked') {
            setExpandedHintId((current) => (current === lesson.id ? null : lesson.id))
            return
        }

        navigate(`/trilha/${lesson.id}`)
    }

    return (
        <main className={styles.page}>
            <Link to="/trilha" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Trilhas
            </Link>

            {/* Cabeçalho tipo cotação (mockup O.0) — ticker/nome + percentual no
                lugar de um `<h1>` puro, mesma cor de trilha (F.1) usada na linha e
                nos nós concluídos do mapa. */}
            <header className={styles.header} style={{ '--accent': track.color } as CSSProperties}>
                <div className={styles.identity}>
                    <span className={styles.ticker}>{track.ticker}</span>
                    <h1 className={styles.title}>{track.name}</h1>
                </div>
                {trackLessons.length > 0 && (
                    <div className={styles.headerActions}>
                        <TrackMapLegend accentColor={track.color} />
                        <div className={styles.quote}>
                            <span className={styles.pct}>{completionPct}%</span>
                            <span className={styles.pctLabel}>
                                {completedCount}/{trackLessons.length} concluídas
                            </span>
                        </div>
                    </div>
                )}
            </header>

            {lessonsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o mapa agora. Tente novamente em instantes.
                </p>
            )}

            {!lessonsQuery.data && !lessonsQuery.isError && <p className={styles.loading}>Carregando mapa…</p>}

            <div className={styles.main}>
                {trackLessons.length >= 2 && (
                    <TrackPath
                        lessons={trackLessons}
                        accentColor={track.color}
                        expandedHintId={expandedHintId}
                        onNodeClick={handleNodeClick}
                    />
                )}

                {/* `computeTrackPathLayout` exige 2+ lições pro zigue-zague fazer
                    sentido (`trackPathLayout/index.ts:89`) — trilha de 1 lição só
                    (caso do teaser Renda Fixa hoje) cai num único `LessonNode`,
                    mesmo fallback que a página horizontal antiga (`Track`,
                    removida na O.4) já usava antes da O.3. */}
                {trackLessons.length === 1 && (
                    <div className={styles.singleNode}>
                        <LessonNode
                            status={trackLessons[0].status}
                            title={trackLessons[0].title}
                            meta={statusLabel(trackLessons[0])}
                            onClick={() => handleNodeClick(trackLessons[0])}
                        />
                        {expandedHintId === trackLessons[0].id && <p className={styles.hint}>Conclua a lição anterior pra desbloquear.</p>}
                    </div>
                )}
            </div>
        </main>
    )
}
