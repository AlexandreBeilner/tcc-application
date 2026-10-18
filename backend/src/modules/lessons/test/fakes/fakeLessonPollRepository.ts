import type { LessonPollRepository } from '../../application/ports/lessonPollRepository'

export function createFakeLessonPollRepository(): LessonPollRepository & {
  // Só de teste: planta `count` votos anônimos numa opção.
  seed(lessonId: string, pollId: string, option: number, count: number): void
} {
  const votes = new Map<string, number>()
  const key = (userId: string, lessonId: string, pollId: string) =>
    `${userId}|${lessonId}|${pollId}`

  return {
    seed(lessonId, pollId, option, count) {
      for (let i = 0; i < count; i += 1) {
        votes.set(key(`seed-${option}-${i}`, lessonId, pollId), option)
      }
    },

    async castVote({ userId, lessonId, pollId, option }) {
      const k = key(userId, lessonId, pollId)
      if (!votes.has(k)) votes.set(k, option)
      return votes.get(k) as number
    },

    async listVotesForUser(userId, lessonId) {
      const prefix = `${userId}|${lessonId}|`
      return [...votes.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, option]) => ({ pollId: k.slice(prefix.length), option }))
    },

    async tally(lessonId, pollId) {
      const counts = new Map<number, number>()
      for (const [k, option] of votes) {
        const [, l, p] = k.split('|')
        if (l === lessonId && p === pollId) counts.set(option, (counts.get(option) ?? 0) + 1)
      }
      return [...counts.entries()].map(([option, count]) => ({ option, count }))
    },
  }
}
