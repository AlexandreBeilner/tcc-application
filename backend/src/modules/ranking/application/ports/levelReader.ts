// Port própria e mínima sobre `modules/gamification` (5.1) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `GetProgressionUseCase`. Sem isso, a lista do ranking (tela 7.1) não
// teria nível pra exibir ao lado do nome — decisão de escopo desta sessão
// (5.9), não explícita na descrição original da 5.5.
export interface LevelReader {
  getLevel(userId: string): Promise<number>
}
