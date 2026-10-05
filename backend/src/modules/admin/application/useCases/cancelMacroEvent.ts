import type { MacroEventAdmin } from '../ports/macroEventAdmin'
import type { MacroEventResult } from '../ports/macroEventTrigger'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Cancela um evento macro pendente que ainda não produziu efeito (N.11). As regras (só
// pendente, sem efeito aplicado, nenhum tick em andamento) vivem no motor; aqui só a
// auditoria, inclusive quando o motor recusa (404, 409). O dia agendado do evento vai no
// payload da linha de sucesso.
export class CancelMacroEventUseCase {
  constructor(
    private readonly macroEventAdmin: MacroEventAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, eventId: string): Promise<MacroEventResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'macro_event.cancel',
        targetType: 'macro_event',
        targetId: eventId,
      },
      () => this.macroEventAdmin.cancel(eventId),
      (event) => ({ payload: { title: event.title, triggered_on_day: event.triggered_on_day } }),
    )
  }
}
