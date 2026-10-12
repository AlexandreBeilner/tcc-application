import type { AgendaOption, Assembly, KindPolicies } from '../domain/assembly'
import { UnknownAssemblyKindError } from '../domain/errors'

// O que o resultado de uma assembleia faz no mundo. `winningOption` é `null` quando a pauta não
// passou (o kind decide se ainda precisa registrar algo).
export interface EffectApplier {
  apply(assembly: Assembly, winningOption: AgendaOption | null): Promise<void>
}

export interface AssemblyKindDefinition {
  policies: KindPolicies
  effect: EffectApplier
}

// Registro de kinds: o núcleo pergunta ao registro, nunca decide por `if (kind === ...)`.
// Adicionar um kind é registrar as políticas e o efeito; abrir, votar, apurar e auditar não mudam.
export class AssemblyKindRegistry {
  private readonly kinds = new Map<string, AssemblyKindDefinition>()

  register(kind: string, definition: AssemblyKindDefinition): this {
    this.kinds.set(kind, definition)
    return this
  }

  has(kind: string): boolean {
    return this.kinds.has(kind)
  }

  get(kind: string): AssemblyKindDefinition {
    const definition = this.kinds.get(kind)
    if (!definition) throw new UnknownAssemblyKindError(kind)
    return definition
  }
}
