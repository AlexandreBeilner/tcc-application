import type {
  CorrectedProgression,
  UserCorrectionContext,
  UserCorrections,
} from '../../application/ports/userCorrections'

export interface FakeUserCorrections extends UserCorrections {
  calls: { method: string; args: unknown[] }[]
  failWith?: Error
  context: UserCorrectionContext
}

const progression: CorrectedProgression = { xp: 100, level: 2, currentStreak: 0, longestStreak: 0 }

export function createFakeUserCorrections(): FakeUserCorrections {
  function record<T>(method: string, args: unknown[], result: T): T {
    if (fake.failWith) throw fake.failWith
    fake.calls.push({ method, args })
    return result
  }

  const fake: FakeUserCorrections = {
    calls: [],
    failWith: undefined,
    context: {
      achievements: [{ id: 'a1', name: 'Primeira Semana', description: null, unlocked: false }],
      lessons: [
        { id: 'l1', code: '0.1', title: 'Lição 0.1', trackNumber: 0, status: 'not_started' },
      ],
    },
    async getContext() {
      return fake.context
    },
    async adjustXp(...args) {
      return record('adjustXp', args, progression)
    },
    async setStreak(...args) {
      return record('setStreak', args, progression)
    },
    async grantAchievement(...args) {
      return record('grantAchievement', args, { id: 'a1', name: 'Primeira Semana' })
    },
    async completeLesson(...args) {
      return record('completeLesson', args, { id: 'l1', code: '0.1' })
    },
    async reopenLesson(...args) {
      return record('reopenLesson', args, { id: 'l1', code: '0.1' })
    },
  }

  return fake
}
