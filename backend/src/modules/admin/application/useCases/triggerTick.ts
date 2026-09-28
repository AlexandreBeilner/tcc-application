import type { TickResult, TickTrigger } from '../ports/tickTrigger'

// Sem regra de negócio própria — o tick em si (GBM, Selic, rodadas de
// negociação de bot, etc.) vive inteiro no motor. Existe como classe
// (mesmo raciocínio de TriggerMacroEventUseCase) pra ter um efeito
// colateral de escrita de estado real testável isolado da borda HTTP.
export class TriggerTickUseCase {
  constructor(private readonly tickTrigger: TickTrigger) {}

  async execute(): Promise<TickResult> {
    return this.tickTrigger.run()
  }
}
