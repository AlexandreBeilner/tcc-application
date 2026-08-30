import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { LessonNode } from '../LessonNode'
import type { DailyMission } from '../../../services/missions'
import type { DailyMissionsListProps } from './types'
import styles from './index.module.css'

export type { DailyMissionsListProps } from './types'

// Tela pra cumprir cada missão (inventário 7.3) — só as duas
// auto-reportadas (`.docs/backend/missions.md`) têm rota fixa aqui;
// `lesson_complete` é verificado cruzado de verdade no backend, mas
// também tem destino óbvio (a Trilha).
const MISSION_ROUTE_BY_KEY: Record<string, string> = {
    lesson_complete: '/trilha',
    calculator_compare: '/calculadora',
    feed_read: '/noticias',
}

// Tela 7.3 (RF22) — vive como seção do Portfólio (2.1) nesta fase
// (inventário: "promover a tela própria... se o catálogo de missões
// crescer"). Reaproveita `LessonNode`, generalizado na tarefa 6.8 pra isso
// — mesma linguagem visual de progressão da Trilha. Clique leva pra tela
// que cumpre a missão; `calculator_compare`/`feed_read` são auto-
// reportadas pelo cliente nessas telas mesmas (Calculadora 6.7, Feed
// 6.6), não aqui — esta lista só navega, nunca chama
// `POST /missions/:id/complete` diretamente.
export function DailyMissionsList({ missions, streak }: DailyMissionsListProps) {
    const navigate = useNavigate()

    if (missions.length === 0) {
        return null
    }

    const allCompleted = missions.every((mission) => mission.status === 'completed')

    function handleSelect(mission: DailyMission) {
        const route = MISSION_ROUTE_BY_KEY[mission.key]
        if (route) navigate(route)
    }

    return (
        <div className={styles.list}>
            <span className={styles.streak}>
                <Flame size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>

            {allCompleted && <p className={styles.celebration}>Todas as missões de hoje concluídas! Volte amanhã pra mais.</p>}

            {missions.map((mission) => (
                <LessonNode
                    key={mission.id}
                    status={mission.status === 'completed' ? 'completed' : 'available'}
                    title={mission.title}
                    meta={`${mission.xpReward} XP${mission.status === 'completed' ? ' · concluída hoje' : ''}`}
                    onClick={() => handleSelect(mission)}
                />
            ))}
        </div>
    )
}
