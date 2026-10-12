import type { DuelRepository } from '../../application/ports/duelRepository'
import { occupiesSlot, type Duel } from '../../domain/duel'

export interface FakeDuelRepository extends DuelRepository {
  duels: Map<string, Duel>
}

export function createFakeDuelRepository(): FakeDuelRepository {
  let seq = 0
  const fake: FakeDuelRepository = {
    duels: new Map(),
    async createIfRoom(input, maxSlots) {
      const used = [...fake.duels.values()].filter((d) => occupiesSlot(d, input.challengerId))
      if (used.length >= maxSlots) return null
      const duel: Duel = {
        id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
        challengerId: input.challengerId,
        opponentId: input.opponentId,
        status: 'pending',
        createdAt: input.now,
        expiresAt: input.expiresAt,
        startsAt: null,
        endsAt: null,
        finishedAt: null,
        outcome: null,
        reason: null,
        challengerPct: null,
        opponentPct: null,
        challengerOperated: null,
        opponentOperated: null,
        xpAwardedAt: null,
      }
      fake.duels.set(duel.id, duel)
      return duel
    },
    async findById(id) {
      return fake.duels.get(id) ?? null
    },
    async findOpenBetween(a, b) {
      return (
        [...fake.duels.values()].find(
          (d) =>
            (d.status === 'pending' || d.status === 'active') &&
            ((d.challengerId === a && d.opponentId === b) ||
              (d.challengerId === b && d.opponentId === a)),
        ) ?? null
      )
    },
    async listForUser(userId, limit) {
      return [...fake.duels.values()]
        .filter((d) => d.challengerId === userId || d.opponentId === userId)
        .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
        .slice(0, limit)
    },
    async acceptIfRoom(id, opponentId, startsAt, endsAt, maxSlots) {
      const duel = fake.duels.get(id)
      if (!duel || duel.status !== 'pending' || duel.opponentId !== opponentId) return 'gone'
      const used = [...fake.duels.values()].filter((d) => occupiesSlot(d, opponentId))
      if (used.length >= maxSlots) return 'full'
      fake.duels.set(id, { ...duel, status: 'active', startsAt, endsAt })
      return 'accepted'
    },
    async decline(id, at) {
      return move(fake, id, 'pending', { status: 'declined', finishedAt: at })
    },
    async cancel(id, at) {
      return move(fake, id, 'pending', { status: 'cancelled', finishedAt: at })
    },
    async expire(id, at) {
      return move(fake, id, 'pending', { status: 'expired', finishedAt: at })
    },
    async finish(id, result, at) {
      return move(fake, id, 'active', { status: 'finished', finishedAt: at, ...result })
    },
    async listDueActive(now) {
      return [...fake.duels.values()].filter(
        (d) => d.status === 'active' && d.endsAt !== null && d.endsAt.getTime() <= now.getTime(),
      )
    },
    async listExpiredPending(now) {
      return [...fake.duels.values()].filter(
        (d) => d.status === 'pending' && d.expiresAt.getTime() <= now.getTime(),
      )
    },
    async listFinishedWithoutXp(limit) {
      return [...fake.duels.values()]
        .filter((d) => d.status === 'finished' && d.xpAwardedAt === null)
        .slice(0, limit)
    },
    async markXpAwarded(id, at) {
      const duel = fake.duels.get(id)
      if (duel) fake.duels.set(id, { ...duel, xpAwardedAt: at })
    },
  }
  return fake
}

function move(
  fake: FakeDuelRepository,
  id: string,
  from: Duel['status'],
  patch: Partial<Duel>,
): boolean {
  const duel = fake.duels.get(id)
  if (!duel || duel.status !== from) return false
  fake.duels.set(id, { ...duel, ...patch })
  return true
}
