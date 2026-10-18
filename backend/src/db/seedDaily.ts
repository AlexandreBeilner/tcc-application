import { createDb, type Database } from './client'
import { dailyEvents, dailyQuestions, dailyWords } from './schema'
import { createDrizzleAcceptedWordRepository } from '../modules/daily/infrastructure/persistence/drizzleAcceptedWordRepository'
import { readAcceptedWordsFile } from '../modules/daily/content/acceptedWordsFile'
import { EXTRA_ACCEPTED_WORDS } from '../modules/daily/content/extraAcceptedWords'
import {
  INITIAL_CONTENT,
  toNewEvent,
  toNewQuestion,
  toNewWord,
  validateContent,
  type ContentBundle,
} from '../modules/daily/content/dailyContent'
import type { LearnMore } from '../modules/daily/domain/content'

const learnMoreColumns = (learnMore: LearnMore | null) => ({
  learnMoreKind: learnMore?.kind ?? null,
  learnMoreRef: learnMore?.ref ?? null,
})

export interface SeedSummary {
  acceptedVero: number
  acceptedExtra: number
  words: number
  questions: number
  events: number
}

// Importa só o que falta, por chave estável, e nunca sobrescreve: texto editado depois pelo painel
// (DI.5.1) sobrevive a um novo `db:seed:daily`. Mesma regra do seed de lições (N.23), então nada de
// `onConflictDoUpdate` aqui. Recusa gravar se o conteúdo não passa na validação (por exemplo, uma
// palavra-resposta que não está na lista aceita). Devolve quantas linhas entraram nesta execução.
export async function seedDailyContent(
  db: Database,
  content: ContentBundle = INITIAL_CONTENT,
  veroWords: readonly string[] = readAcceptedWordsFile(),
  extraWords: readonly string[] = EXTRA_ACCEPTED_WORDS,
): Promise<SeedSummary> {
  const accepted = new Set([...veroWords, ...extraWords])
  const errors = validateContent(content, accepted)
  if (errors.length > 0) {
    throw new Error(`conteúdo do Diário inválido:\n${errors.map((e) => `- ${e}`).join('\n')}`)
  }

  const acceptedRepository = createDrizzleAcceptedWordRepository(db)
  const acceptedVero = await acceptedRepository.addMany(veroWords, 'vero')
  // Uma palavra que está nas duas listas fica com a origem `vero` (entrou primeiro).
  const acceptedExtra = await acceptedRepository.addMany(extraWords, 'extra')

  const words = await db
    .insert(dailyWords)
    .values(
      content.words.map(toNewWord).map(({ learnMore, ...word }) => ({
        ...word,
        ...learnMoreColumns(learnMore),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: dailyWords.id })

  const questions = await db
    .insert(dailyQuestions)
    .values(
      content.questions.map(toNewQuestion).map(({ learnMore, reviewedAt, ...question }) => ({
        ...question,
        ...learnMoreColumns(learnMore),
        reviewedAt,
      })),
    )
    .onConflictDoNothing({ target: dailyQuestions.stableKey })
    .returning({ id: dailyQuestions.id })

  const events = await db
    .insert(dailyEvents)
    .values(
      content.events.map(toNewEvent).map(({ learnMore, reviewedAt, sourceRef, ...event }) => ({
        ...event,
        sourceRef,
        ...learnMoreColumns(learnMore),
        reviewedAt,
      })),
    )
    .onConflictDoNothing({ target: dailyEvents.stableKey })
    .returning({ id: dailyEvents.id })

  return {
    acceptedVero,
    acceptedExtra,
    words: words.length,
    questions: questions.length,
    events: events.length,
  }
}

// Idempotente: DATABASE_URL=... npm run db:seed:daily
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  const summary = await seedDailyContent(db)
  console.log(
    `Diário: ${summary.acceptedVero} palavras aceitas do VERO e ${summary.acceptedExtra} extras novas; ` +
      `${summary.words} palavras-resposta, ${summary.questions} perguntas e ${summary.events} eventos novos`,
  )
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao rodar seed do Diário:', err)
    process.exit(1)
  })
}
