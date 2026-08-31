// Port própria e mínima sobre `modules/gamification` (5.1) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `GetProgressionUseCase`. Sem isso, a lista do ranking (tela 7.1) não
// teria nível pra exibir ao lado do nome — decisão de escopo desta sessão
// (5.9), não explícita na descrição original da 5.5.
//
// `xp` (tarefa 6.8.3) foi acrescentado ao mesmo método em vez de virar uma
// chamada própria — `GetProgressionUseCase` já devolve os dois campos numa
// única leitura de `user_progression`, então expor só `level` e precisar de
// uma segunda porta pra `xp` duplicaria a mesma consulta. O critério "maior
// nível" ordena por `xp` (não por `level`) pra desempatar corretamente
// dentro de um mesmo nível.
export interface LevelReader {
  getProgression(userId: string): Promise<{ level: number; xp: number }>
}
