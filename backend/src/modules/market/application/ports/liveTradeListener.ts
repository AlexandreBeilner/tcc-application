// Avisa outro módulo de que a pessoa acabou de operar no mercado AO VIVO (hoje, o marco de
// "primeira operação" do painel de retenção, RT.1.1). Sandbox nunca dispara. Best-effort: falha é
// só logada e nunca desfaz a ordem já executada no motor.
export interface LiveTradeListener {
  onLiveTrade(userId: string, kind: 'order' | 'fixed_income'): Promise<void>
}
