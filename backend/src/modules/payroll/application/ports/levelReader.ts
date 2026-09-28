// Port própria e mínima sobre `modules/gamification` (mesmo padrão de
// `ranking/application/ports/levelReader.ts`) — implementada, na composição
// (app.ts), por um adapter em processo sobre `GetProgressionUseCase`. O
// salário mensal (T.3) só precisa do nível atual, nunca de `xp`.
export interface LevelReader {
  getLevel(userId: string): Promise<number>
}
