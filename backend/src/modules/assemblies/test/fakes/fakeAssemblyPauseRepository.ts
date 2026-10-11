import type { AssemblyPauseRepository } from '../../application/ports/assemblyPauseRepository'
import { scopeKeyOf, type AssemblyPause } from '../../domain/pause'

export interface FakeAssemblyPauseRepository extends AssemblyPauseRepository {
  items: AssemblyPause[]
}

export function createFakeAssemblyPauseRepository(): FakeAssemblyPauseRepository {
  let seq = 0
  const fake: FakeAssemblyPauseRepository = {
    items: [],
    async listActive() {
      return fake.items.filter((p) => p.liftedAt === null)
    },
    async listRecent(limit) {
      return [...fake.items]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
    },
    async create(input, adminId, now) {
      const key = scopeKeyOf(input.scope, input.kind, input.subjectRef)
      if (
        fake.items.some(
          (p) => p.liftedAt === null && scopeKeyOf(p.scope, p.kind, p.subjectRef) === key,
        )
      ) {
        return { status: 'conflict' }
      }
      const pause: AssemblyPause = {
        id: `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`,
        scope: input.scope,
        kind: input.kind,
        subjectRef: input.subjectRef,
        reason: input.reason,
        createdBy: adminId,
        createdAt: now,
        liftedAt: null,
        liftedBy: null,
      }
      fake.items.push(pause)
      return { status: 'created', pause }
    },
    async lift(id, adminId, now) {
      const pause = fake.items.find((p) => p.id === id)
      if (!pause) return { status: 'not_found' }
      if (pause.liftedAt) return { status: 'already_lifted' }
      pause.liftedAt = now
      pause.liftedBy = adminId
      return { status: 'lifted', pause }
    },
  }
  return fake
}
