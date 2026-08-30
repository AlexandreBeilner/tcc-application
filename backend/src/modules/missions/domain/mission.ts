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
}

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

// Dia calendário em UTC, formato YYYY-MM-DD — mesma convenção de
// `gamification/domain/streak.ts` (5.3) e `lessons/domain/lesson.ts`
// (`utcDateString`, 5.4): sem conceito de fuso do usuário no modelo hoje.
export function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10)
}
