import type { TickResult, TickTrigger } from '../ports/tickTrigger'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Sem regra de negócio própria — o tick em si (GBM, Selic, rodadas de
// negociação de bot, etc.) vive inteiro no motor. Existe como classe
// (mesmo raciocínio de TriggerMacroEventUseCase) pra ter um efeito
// colateral de escrita de estado real testável isolado da borda HTTP. A
// orquestração que sobra é a auditoria (N.4): quem disparou, e se o motor
// aceitou ou recusou (ex: 409 de tick em andamento).
export class TriggerTickUseCase {
  constructor(
    private readonly tickTrigger: TickTrigger,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string): Promise<TickResult> {
    return this.recordAdminAction.run(
      { adminId, action: 'tick.trigger', targetType: 'tick' },
      () => this.tickTrigger.run(),
      (result) => ({ targetId: String(result.day), payload: { day: result.day } }),
    )
  }
}
