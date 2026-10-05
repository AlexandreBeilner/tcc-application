import type { MissionPatch } from '../../domain/catalog'
import type { Mission, MissionProgressSnapshot, MissionStatus } from '../../domain/mission'

export interface MissionProgressExportRecord {
  missionId: string
  missionDate: string
  status: MissionStatus
  completedAt: Date | null
}

// Quantos usuários concluíram uma missão (N.19): no total (usuários distintos, em qualquer
// dia) e no dia pedido.
export interface MissionCompletionCount {
  users: number
  today: number
}

export interface MissionRepository {
  // Só as missões ATIVAS: é o conjunto do qual o dia é montado (`ensureTodayProgress`) e que
  // o jogador vê. Missão desativada pelo painel (N.19) sai daqui, então não é gerada no dia
  // seguinte nem aparece em `GET /missions`.
  listCatalog(): Promise<Mission[]>
  // Catálogo completo, ativas e desativadas, só pro painel.
  listAll(): Promise<Mission[]>
  // Edita texto, XP e liga/desliga (N.19); devolve a missão atualizada ou `undefined` se o id
  // não existe. Nunca mexe no progresso já gravado dos usuários.
  update(id: string, patch: MissionPatch): Promise<Mission | undefined>
  // Conclusões por missão (id da missão → contagem); `today` é o dia UTC (YYYY-MM-DD).
  countCompletions(today: string): Promise<Map<string, MissionCompletionCount>>
  // Qualquer missão, inclusive a desativada (quem decide se pode ser concluída é o caso de uso).
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
  // Transição atômica pending/inexistente → completed (UPSERT condicional
  // no adapter real, não um `findProgress` + `UPDATE` separados) — devolve
  // `true` só pra quem de fato realizou a transição agora. Duas chamadas
  // concorrentes pra `(userId, missionId, missionDate)` só podem ter uma
  // vencedora; a perdedora recebe `false` mesmo sem erro, evitando que
  // `CompleteMissionUseCase` credite xp em dobro sob corrida (ver
  // `findProgress` acima, que é só um atalho pra reenvio sequencial, não a
  // proteção real).
  markCompleted(userId: string, missionId: string, missionDate: string): Promise<boolean>
  // Todo o histórico do usuário, qualquer data — só pra exportação de dados
  // (5.11, RNF04); `listProgressForDate` continua sendo o caminho de leitura
  // do dia corrente (GET /missions).
  listAllProgressForUser(userId: string): Promise<MissionProgressExportRecord[]>
}
