import type { Progression } from '../../domain/progression'

export interface ProgressionRepository {
  findByUserId(userId: string): Promise<Progression | undefined>
  upsert(progression: Progression): Promise<Progression>
}
