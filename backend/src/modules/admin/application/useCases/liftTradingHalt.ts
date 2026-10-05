import type { TradingHalt, TradingHaltAdmin } from '../ports/tradingHaltAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Retomada da negociação (N.9): encerra uma pausa. Retomar não força uma rodada de bots;
// quem quiser liquidez imediata dispara 1 tick na tela de Tempo.
export class LiftTradingHaltUseCase {
  constructor(
    private readonly tradingHaltAdmin: TradingHaltAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, haltId: string): Promise<TradingHalt> {
    return this.recordAdminAction.run(
      { adminId, action: 'trading.resume', targetType: 'trading_halt', targetId: haltId },
      () => this.tradingHaltAdmin.lift(haltId, adminId),
      (halt) => ({ payload: { scope: halt.scope, asset_id: halt.asset_id, ticker: halt.ticker } }),
    )
  }
}
