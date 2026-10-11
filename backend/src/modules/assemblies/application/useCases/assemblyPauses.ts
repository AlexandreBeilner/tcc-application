import { AssemblyPauseConflictError, AssemblyPauseNotFoundError } from '../../domain/errors'
import { validateNewPause, type AssemblyPause, type NewPauseInput } from '../../domain/pause'
import type { AssemblyPauseRepository } from '../ports/assemblyPauseRepository'

const RECENT_LIMIT = 20

export interface AssemblyPauseListing {
  active: AssemblyPause[]
  recent: AssemblyPause[]
}

export class ListAssemblyPausesUseCase {
  constructor(private readonly pauses: AssemblyPauseRepository) {}

  async execute(): Promise<AssemblyPauseListing> {
    const [active, recent] = await Promise.all([
      this.pauses.listActive(),
      this.pauses.listRecent(RECENT_LIMIT),
    ])
    return { active, recent: recent.filter((p) => p.liftedAt !== null) }
  }
}

// Pausa o ciclo (global ou de uma empresa). Só impede abrir e aplicar: nada é apagado, fechar e
// apurar continuam (o prazo é uma promessa a quem vota), então retomar continua de onde parou.
export class PauseAssembliesUseCase {
  constructor(
    private readonly pauses: AssemblyPauseRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(adminId: string, input: NewPauseInput): Promise<AssemblyPause> {
    const valid = validateNewPause(input)
    const result = await this.pauses.create(valid, adminId, this.now())
    if (result.status === 'conflict') {
      throw new AssemblyPauseConflictError(
        valid.scope === 'global'
          ? 'já existe uma pausa global vigente'
          : 'já existe uma pausa vigente para esta empresa',
      )
    }
    return result.pause
  }
}

export class LiftAssemblyPauseUseCase {
  constructor(
    private readonly pauses: AssemblyPauseRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(adminId: string, pauseId: string): Promise<AssemblyPause> {
    const result = await this.pauses.lift(pauseId, adminId, this.now())
    if (result.status === 'not_found') throw new AssemblyPauseNotFoundError('pausa não encontrada')
    if (result.status === 'already_lifted') {
      throw new AssemblyPauseConflictError('esta pausa já foi retomada')
    }
    return result.pause
  }
}
