export type MissionStatus = 'pending' | 'completed'

export interface Mission {
  id: string
  // Slug estável (ex: 'feed_read') — identificador pra código cliente achar
  // uma missão específica sem depender de `title` (tarefa 6.6.4; ver
  // `.docs/backend/missions.md`).
  key: string
  title: string
  description: string | null
  completionCriteria: string
  xpReward: number
  // Só a missão "complete uma lição da trilha" tem esse tratamento nesta
  // fase — `completionCriteria` é texto livre, não sustenta uma verificação
  // cruzada real (ver schema.ts, tarefa 5.4).
  requiresLessonCompletion: boolean
  // Desativada pelo painel (N.19): não é gerada pro dia nem pode ser concluída. O que
  // já foi concluído fica como está (XP e streak não são tirados).
  isActive: boolean
}

// Única missão com verificação cruzada dispatchada por `key` em vez de uma
// coluna dedicada (H.2, ver comentário em `completeMission.ts`) — string
// solta seria frágil contra erro de digitação nos dois lugares que
// precisam bater (`seedMissions.ts` e o dispatch aqui).
export const REVIEW_OLD_LESSON_MISSION_KEY = 'review_old_lesson'

// Terceira missão com verificação cruzada real (backlog engajamento H.3),
// mesmo tratamento por `key` de `REVIEW_OLD_LESSON_MISSION_KEY` acima.
export const MICRO_DECISION_STREAK_MISSION_KEY = 'micro_decision_streak_today'

// Quarta missão com verificação cruzada real (DI.6.1, ponto 060), mesmo tratamento por `key`:
// conferida contra `daily_results` (jogo do dia concluído antes da virada, com XP).
export const PLAY_DAILY_MISSION_KEY = 'play_daily'

export interface MissionProgressSnapshot {
  status: MissionStatus
}

export interface MissionView extends Mission {
  status: MissionStatus
}

export function buildMissionView(
  mission: Mission,
  progress: MissionProgressSnapshot | undefined,
): MissionView {
  return { ...mission, status: progress?.status ?? 'pending' }
}

// Implementação real em `shared/utcDate.ts` (compartilhada com
// `gamification`/`lessons`) — `todayUtc` é só o nome já em uso por este módulo.
export { utcDateString as todayUtc } from '../../../shared/utcDate'
