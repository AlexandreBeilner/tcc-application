import type { AssemblyPause, ValidPause } from '../../domain/pause'

export type CreatePauseResult = { status: 'created'; pause: AssemblyPause } | { status: 'conflict' }
export type LiftPauseResult =
  | { status: 'lifted'; pause: AssemblyPause }
  | { status: 'not_found' }
  | { status: 'already_lifted' }

// O ciclo só precisa saber quais pausas estão vigentes (abrir e aplicar consultam a cada rodada).
export interface AssemblyPauseReader {
  listActive(): Promise<AssemblyPause[]>
}

export interface AssemblyPauseRepository extends AssemblyPauseReader {
  listRecent(limit: number): Promise<AssemblyPause[]>
  // Uma pausa vigente por escopo (índice único): a segunda tentativa devolve `conflict`.
  create(input: ValidPause, adminId: string, now: Date): Promise<CreatePauseResult>
  lift(id: string, adminId: string, now: Date): Promise<LiftPauseResult>
}
