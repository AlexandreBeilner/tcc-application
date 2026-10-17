// Quantos dias do Diário cada pessoa jogou numa janela (DI.6.2). Conta só jogo concluído dentro do
// próprio dia (`completedAt` preenchido e `xpAwarded > 0`), a mesma regra do XP e do streak.
export interface DailyPlayedReader {
  // `from` e `to` são dias UTC (`YYYY-MM-DD`), inclusive. Devolve `null` se ninguém jogou nada na
  // janela (Diário ainda sem dado); do contrário, um mapa só com quem jogou pelo menos um dia.
  countPlayedDays(
    userIds: string[],
    window: { from: string; to: string },
  ): Promise<Map<string, number> | null>
}
