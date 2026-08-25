import type { Mission, MissionProgressSnapshot } from '../../domain/mission'

export interface MissionRepository {
  listCatalog(): Promise<Mission[]>
  findById(id: string): Promise<Mission | undefined>
  // Gera a linha `pending` de hoje pra cada missão do catálogo que o
  // usuário ainda não tem — idempotente (ON CONFLICT DO NOTHING sobre o
  // UNIQUE(user_id, mission_id, mission_date) já existente).
  ensureTodayProgress(userId: string, missionIds: string[], missionDate: string): Promise<void>
  listProgressForDate(
    userId: string,
    missionDate: string,
  ): Promise<(MissionProgressSnapshot & { missionId: string })[]>
  findProgress(
    userId: string,
    missionId: string,
    missionDate: string,
  ): Promise<MissionProgressSnapshot | undefined>
  markCompleted(userId: string, missionId: string, missionDate: string): Promise<void>
}
