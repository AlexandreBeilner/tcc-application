import { GraduationCap } from 'lucide-react'
import type { TrackTrophyCaseProps } from './types'
import styles from './index.module.css'

export type { TrackTrophyCaseProps } from './types'

// Currículo fixo de 4 trilhas (spec 5.1) — nome e cor (tarefa F.1,
// identidade-visual-tokens.md §2.6) vivem aqui como dado estático porque
// `GetPublicProfileUseCase` só devolve o número da trilha (`completedTracks:
// number[]`), nunca o nome: não é RNF09 (nada de patrimônio em jogo), é só
// dado de currículo que não muda por usuário.
const TRACKS = [
    { number: 0, name: 'Fundamentos', color: 'var(--color-track-0)', background: 'var(--color-brand-100)' },
    { number: 1, name: 'Renda Fixa', color: 'var(--color-track-1)', background: 'var(--color-gain-100)' },
    { number: 2, name: 'Renda Variável', color: 'var(--color-track-2)', background: 'var(--color-loss-100)' },
    { number: 3, name: 'Estratégia e Tributação', color: 'var(--color-track-3)', background: 'var(--color-gamify-100)' },
] as const

// F.3 (backlog de engajamento, Fase F — sala de troféus do Perfil):
// substitui a conquista genérica "Formado na Trilha" (hoje só mais um item
// em `AchievementsGrid`) por um emblema visualmente distinto por trilha.
// Diferente de `AchievementsGrid` (sempre mostra a lista cheia, bloqueada
// ou não), aqui só a trilha *concluída* existe de verdade — sem estado
// "bloqueado" pra desenhar. Sem nenhuma trilha concluída, a seção inteira
// some (mesmo padrão de `ResumeLessonCard`/`TrackChart` — nunca um "nenhuma
// trilha concluída" vazio, critério de aceite explícito da tarefa).
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
