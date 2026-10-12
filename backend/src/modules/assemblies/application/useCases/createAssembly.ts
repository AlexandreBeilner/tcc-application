import { validateNewAssembly, type NewAssemblyInput } from '../../domain/assembly'
import { UnknownAssemblyKindError } from '../../domain/errors'
import type { AssemblyKindRegistry } from '../assemblyKinds'
import type { AssemblyRepository, AssemblyWithOptions } from '../ports/assemblyRepository'

// Cria uma assembleia de qualquer kind registrado. Idempotente pelo `dedupeKey`.
export class CreateAssemblyUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: NewAssemblyInput): Promise<AssemblyWithOptions & { created: boolean }> {
    if (!this.kinds.has(input.kind)) throw new UnknownAssemblyKindError(input.kind)
    validateNewAssembly(input)
    return this.repository.create(input, this.now())
  }
}
