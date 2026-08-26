import type { Mission, MissionProgressSnapshot, MissionStatus } from '../../domain/mission'

export interface MissionProgressExportRecord {
  missionId: string
  missionDate: string
  status: MissionStatus
  completedAt: Date | null
}

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
  // Todo o histórico do usuário, qualquer data — só pra exportação de dados
  // (5.11, RNF04); `listProgressForDate` continua sendo o caminho de leitura
  // do dia corrente (GET /missions).
  listAllProgressForUser(userId: string): Promise<MissionProgressExportRecord[]>
}
