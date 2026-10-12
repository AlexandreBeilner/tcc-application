import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { DeclarationSource } from '../ports/declarationSource'
import type { TallyAssemblyUseCase } from './tallyAssembly'

export interface CloseDueResult {
  closed: number
  approved: number
  failed: number
}

const BATCH = 100

// Fecha as assembleias abertas cujo prazo passou: apura com o snapshot da data de corte e grava o
// resultado (público a partir daqui, antes de o efeito valer). Sem o mínimo de votantes, ou com
// empate, fecha como "não aprovada". `close` é condicional ao estado, então duas rodadas
// simultâneas não fecham duas vezes.
//
// Assembleia de destinação do lucro (MO.6.13): se fechou sem decisão (sem quórum ou empate), a
// declaração de dividendo retida no motor é liberada na hora, com o payout vigente. Se a liberação
// falhar a assembleia continua fechada e o prazo de segurança do motor libera o dividendo.
export class CloseDueAssembliesUseCase {
  constructor(
    private readonly repository: AssemblyRepository,
    private readonly tally: TallyAssemblyUseCase,
    private readonly declarations: DeclarationSource | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<CloseDueResult> {
    const now = this.now()
    const due = await this.repository.listOpenDue(now, BATCH)
    const result: CloseDueResult = { closed: 0, approved: 0, failed: 0 }
    for (const assembly of due) {
      try {
        const tally = await this.tally.execute(assembly.id)
        const closed = await this.repository.close(assembly.id, {
          outcome: tally.outcome,
          reason: tally.reason,
          winningOptionId: tally.winningOptionId,
          voterCount: tally.voters,
          decidedAt: now,
        })
        if (!closed) continue
        result.closed += 1
        if (tally.outcome === 'approved') result.approved += 1
        else await this.releaseDeclaration(assembly.declarationId)
      } catch (err) {
        result.failed += 1
        console.error(`assembleias: falha ao fechar a assembleia ${assembly.id}`, err)
      }
    }
    return result
  }

  private async releaseDeclaration(declarationId: string | null): Promise<void> {
    if (!declarationId || !this.declarations) return
    try {
      await this.declarations.release(declarationId, 'no_decision')
    } catch (err) {
      console.error(`assembleias: falha ao liberar a declaração ${declarationId}`, err)
    }
  }
}
