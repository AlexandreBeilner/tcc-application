import { InvalidMacroEventError } from '../../domain/errors'
import type {
  MacroEventResult,
  MacroEventTrigger,
  TriggerMacroEventInput,
} from '../../application/ports/macroEventTrigger'

export function createEngineMacroEventTrigger(engineUrl: string): MacroEventTrigger {
  return {
    async trigger(input: TriggerMacroEventInput): Promise<MacroEventResult> {
      const res = await fetch(`${engineUrl}/macro-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      // 400 do motor é rejeição de regra de negócio (template inexistente,
      // alvo com escopo ambíguo etc.) — traduzido pra um erro de domínio
      // que o router sabe mapear de volta pra 400, não pra falha genérica.
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new InvalidMacroEventError(body.error ?? 'evento macro inválido')
      }
      if (!res.ok) {
        throw new Error(
          `falha ao disparar evento macro no motor de simulação (status ${res.status})`,
        )
      }

      return (await res.json()) as MacroEventResult
    },
  }
}
