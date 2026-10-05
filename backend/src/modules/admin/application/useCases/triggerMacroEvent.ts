import type {
  MacroEventResult,
  MacroEventTrigger,
  TriggerMacroEventInput,
} from '../ports/macroEventTrigger'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// A regra de negócio do disparo (validar template, sortear efeito por
// banda, calcular defasagem preço↔fundamentos) vive inteira no motor
// (macroeventtrigger.Service, tarefa 4.4) — este caso de uso não repete
// nada disso, só a orquestração real que ele tem: entrada já validada por
// Zod (interfaces/http) → port. Existe como classe (e não uma chamada
// direta à port no router, como authRouter.ts faz para "montar URL do
// Google") porque, diferente daquele exemplo, aqui há um efeito colateral
// de escrita de estado real (evento persistido no motor) que o backlog
// (4.4) exige cobrir com teste de caso de uso isolado da borda HTTP.
export class TriggerMacroEventUseCase {
  constructor(
    private readonly macroEventTrigger: MacroEventTrigger,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  // Auditado (N.4): grava quem disparou, o que pediu e o id do evento criado,
  // ou o motivo da recusa do motor.
  async execute(adminId: string, input: TriggerMacroEventInput): Promise<MacroEventResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'macro_event.trigger',
        targetType: 'macro_event',
        payload: { ...input },
      },
      () => this.macroEventTrigger.trigger(input),
      (event) => ({ targetId: event.id }),
    )
  }
}
