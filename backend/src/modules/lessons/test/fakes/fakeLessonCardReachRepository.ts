import { isBeyond, type CardPosition, type CardReachRow } from '../../domain/cardReach'
import type { LessonCardReachRepository } from '../../application/ports/lessonCardReachRepository'

export function createFakeLessonCardReachRepository(): LessonCardReachRepository {
  const furthest = new Map<string, CardPosition>()
  const counts = new Map<string, number>()

  return {
    async recordReach({ userId, lessonId, position, day }) {
      const key = `${userId}|${lessonId}`
      const current = furthest.get(key)
      if (current && !isBeyond(position, current)) {
        return false
      }
      furthest.set(key, position)
      const countKey = `${lessonId}|${position.phase}|${position.cardIndex}|${day}`
      counts.set(countKey, (counts.get(countKey) ?? 0) + 1)
      return true
    },

    async listReach(lessonId, sinceDay) {
      const rows: CardReachRow[] = []
      for (const [key, reached] of counts) {
        const [id, phase, cardIndex, day] = key.split('|')
        if (id === lessonId && (day as string) >= sinceDay) {
          rows.push({ phase: Number(phase), cardIndex: Number(cardIndex), reached })
        }
      }
      return rows
    },
  }
}
