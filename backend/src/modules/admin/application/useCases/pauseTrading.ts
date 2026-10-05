import type { PauseTradingInput, TradingHalt, TradingHaltAdmin } from '../ports/tradingHaltAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Pausa de negociação, global ou de um ativo (N.9). As regras (uma vigente por escopo,
// ativo negociável) vivem no motor; aqui só a auditoria, inclusive quando o motor
// recusa (409 já pausado, 404 ativo inexistente). O id da pausa criada vira o alvo da linha.
export class PauseTradingUseCase {
  constructor(
    private readonly tradingHaltAdmin: TradingHaltAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, input: PauseTradingInput): Promise<TradingHalt> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'trading.halt',
        targetType: 'trading_halt',
        payload: { scope: input.scope, asset_id: input.assetId ?? null, reason: input.reason },
      },
      () => this.tradingHaltAdmin.pause(input, adminId),
      (halt) => ({ targetId: halt.id }),
    )
  }
}
