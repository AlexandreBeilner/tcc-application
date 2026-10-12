import type { EffectApplier } from '../../application/assemblyKinds'
import { describeEffectProblem, readOptionEffects, type OptionEffect } from '../../domain/effects'
import { engineJson } from './engineClient'

// O efeito vem do catálogo de pautas e nunca carrega valor absoluto de degrau: só alavanca, sentido
// e que fração da faixa do motor usar (a política de dividendo traz o valor-alvo). Valida aqui para
// um catálogo malformado falhar com mensagem clara (o motor valida de novo, e é ele quem decide o
// tamanho da mudança).
export function parseEngineEffects(raw: Record<string, unknown>): OptionEffect[] {
  const effects = readOptionEffects(raw)
  if (!effects) throw new Error(`efeitos da opção inválidos: ${describeEffectProblem(raw)}`)
  return effects
}

// Entrega ao motor a decisão JÁ aprovada (`POST /governance/decisions`, idempotente pelo id da
// assembleia), com de 1 a 2 efeitos. Na assembleia de destinação do lucro vai junto o id da
// declaração de dividendo retida, que o motor libera quando o efeito de destinação for aplicado.
// Pauta que não passou (`winningOption` nulo) nunca chega ao motor.
export function createEngineShareholderEffect(engineUrl: string): EffectApplier {
  return {
    async apply(assembly, winningOption) {
      if (!winningOption) return
      await engineJson(`${engineUrl}/governance/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assembly_id: assembly.id,
          company_id: assembly.subjectRef,
          option_key: winningOption.key,
          ...(assembly.declarationId ? { declaration_id: assembly.declarationId } : {}),
          effects: parseEngineEffects(winningOption.effect),
        }),
      })
    },
  }
}
