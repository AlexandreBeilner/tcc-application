import { GraduationCap } from 'lucide-react'
import { TRACKS } from '../../../utils/tracks'
import type { TrackTrophyCaseProps } from './types'
import styles from './index.module.css'

export type { TrackTrophyCaseProps } from './types'

// F.3 (backlog de engajamento, Fase F — sala de troféus do Perfil):
// substitui a conquista genérica "Formado na Trilha" (hoje só mais um item
// em `AchievementsGrid`) por um emblema visualmente distinto por trilha.
// Diferente de `AchievementsGrid` (sempre mostra a lista cheia, bloqueada
// ou não), aqui só a trilha *concluída* existe de verdade — sem estado
// "bloqueado" pra desenhar. Sem nenhuma trilha concluída, a seção inteira
// some (mesmo padrão de `ResumeLessonCard`/Mapa da Trilha — nunca um
// "nenhuma trilha concluída" vazio, critério de aceite explícito da tarefa).
export function TrackTrophyCase({ completedTracks }: TrackTrophyCaseProps) {
    const trophies = TRACKS.filter((track) => completedTracks.includes(track.number))

    if (trophies.length === 0) return null

    return (
        <div className={styles.section}>
            <h2 className={styles.title}>Trilhas concluídas</h2>
            <ul className={styles.grid}>
                {trophies.map((track) => (
                    <li key={track.number} className={styles.trophy} style={{ background: track.background, color: track.color }}>
                        <GraduationCap size={16} strokeWidth={2} aria-hidden="true" />
                        <span className={styles.name}>{track.name}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
