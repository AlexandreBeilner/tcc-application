import type { Progression, Streak } from '../../../services/gamification'
import type { NextUnlock } from '../../../features/lessons/nextUnlockFor'

export interface ProgressionSummaryProps {
    progression: Progression
    streak: Streak
    // Opcional/omitido enquanto `GET /lessons` ainda não resolveu (tarefa
    // J.4) — os dois badges de XP/streak não esperam por essa query.
    nextUnlock?: NextUnlock | null
}
