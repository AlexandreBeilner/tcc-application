// Avisa outro módulo de que a pessoa logada acabou de fechar um jogo do Diário (hoje, o marco de
// "primeiro Diário" do painel de retenção, RT.1.1). Vale também para dia anterior, sem XP. Best-effort:
// falha é só logada e nunca desfaz o resultado já gravado.
export interface DailyCompletionListener {
  onDailyCompleted(userId: string): Promise<void>
}
