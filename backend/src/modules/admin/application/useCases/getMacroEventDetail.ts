import type { MacroEventAdmin, MacroEventDetail } from '../ports/macroEventAdmin'
import type { MacroEventResult } from '../ports/macroEventTrigger'
import type { UserViewProjector } from '../ports/userViewProjector'

export interface MacroEventDetailWithUserView extends MacroEventDetail {
  // O que o usuário vê deste evento hoje: o veredito redigido enquanto está pendente.
  // Só faz sentido quando `publicly_visible`; antes disso o usuário não vê nada.
  user_view: MacroEventResult
}

// Leitura do detalhe de um evento macro (N.11): o motor devolve o evento, o estado de ciclo
// de vida e o impacto realizado; aqui só se junta a versão que o usuário vê, pela regra do
// módulo de notícias. Leitura, sem auditoria.
export class GetMacroEventDetailUseCase {
  constructor(
    private readonly macroEventAdmin: MacroEventAdmin,
    private readonly userViewProjector: UserViewProjector,
  ) {}

  async execute(eventId: string, windowDays?: number): Promise<MacroEventDetailWithUserView> {
    const detail = await this.macroEventAdmin.detail(eventId, windowDays)
    return { ...detail, user_view: this.userViewProjector.project(detail) }
  }
}
