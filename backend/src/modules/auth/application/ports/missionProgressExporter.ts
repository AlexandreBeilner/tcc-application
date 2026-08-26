// Port própria e mínima sobre `modules/missions` (5.4) — implementada, na
// composição (app.ts), por um adapter em processo sobre
// `ExportMissionProgressUseCase`.
export interface ExportedMissionProgress {
  missionId: string
  missionDate: string
  status: 'pending' | 'completed'
  completedAt: Date | null
}

export interface MissionProgressExporter {
  exportForUser(userId: string): Promise<ExportedMissionProgress[]>
}
