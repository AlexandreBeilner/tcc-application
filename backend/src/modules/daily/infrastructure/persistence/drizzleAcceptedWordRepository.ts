import { and, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyAcceptedWords } from '../../../../db/schema'
import type { AcceptedWordRepository } from '../../application/ports/acceptedWordRepository'

// Lotes: a lista gerada tem centenas de milhares de formas e o Postgres limita os parâmetros por comando.
const BATCH = 5000

export function createDrizzleAcceptedWordRepository(db: Database): AcceptedWordRepository {
  return {
    async isAccepted(word) {
      const [row] = await db
        .select({ word: dailyAcceptedWords.word })
        .from(dailyAcceptedWords)
        .where(eq(dailyAcceptedWords.word, word))
        .limit(1)
      return row !== undefined
    },

    async listExtra() {
      const rows = await db
        .select({ word: dailyAcceptedWords.word })
        .from(dailyAcceptedWords)
        .where(eq(dailyAcceptedWords.source, 'extra'))
        .orderBy(dailyAcceptedWords.word)
      return rows.map((r) => r.word)
    },

    async removeExtra(word) {
      const removed = await db
        .delete(dailyAcceptedWords)
        .where(and(eq(dailyAcceptedWords.word, word), eq(dailyAcceptedWords.source, 'extra')))
        .returning({ word: dailyAcceptedWords.word })
      return removed.length > 0
    },

    async addMany(words, source) {
      let added = 0
      for (let i = 0; i < words.length; i += BATCH) {
        const inserted = await db
          .insert(dailyAcceptedWords)
          .values(words.slice(i, i + BATCH).map((word) => ({ word, source })))
          .onConflictDoNothing()
          .returning({ word: dailyAcceptedWords.word })
        added += inserted.length
      }
      return added
    },
  }
}
