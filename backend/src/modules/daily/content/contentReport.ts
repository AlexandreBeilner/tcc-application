import { normalizeWord } from '../domain/wordGuess'
import { DAILY_CATEGORIES } from './categories'
import { MAX_EXPLANATION_LENGTH, validateContent, type ContentBundle } from './dailyContent'

// Relatório do estoque de conteúdo do Diário, usado pela skill `diario-conteudo` para decidir o que
// criar e para conferir o resultado. Só leitura: não grava nada e não substitui `validateContent`
// (que é o portão), apenas mostra o estado e aponta lacunas e possíveis duplicatas.

// Mínimos que os testes de `dailyContent.test.ts` já exigem do conteúdo inicial.
export const CONTENT_FLOOR = { words: 250, questions: 30, events: 56 } as const

// Quanto da explicação já é "quase no teto": o painel de edição pode estourar ao ajustar.
const NEAR_LIMIT = MAX_EXPLANATION_LENGTH - 30

interface Tallied {
  total: number
  brasilShare: number
  byCategory: Record<string, number>
  emptyCategories: string[]
}

export interface ContentReport {
  counts: { words: number; questions: number; events: number }
  // Dias de agenda que o banco sustenta sem repetir item: palavra e pergunta uma por dia, quatro
  // eventos por dia (a janela de não repetição de eventos é menor, então isto é folga, não limite).
  runwayDays: { words: number; questions: number; events: number }
  belowFloor: string[]
  words: Tallied
  questions: Tallied & { correctIndex: Record<string, number> }
  events: Tallied & { distinctYears: number; byDecade: Record<string, number> }
  nearLimit: string[]
  possibleDuplicates: string[]
  errors: string[]
}

function tally(items: readonly { category: string; scope: string }[]): Tallied {
  const byCategory: Record<string, number> = {}
  for (const item of items) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
  const brasil = items.filter((item) => item.scope === 'brasil').length
  return {
    total: items.length,
    brasilShare: items.length === 0 ? 0 : brasil / items.length,
    byCategory,
    emptyCategories: DAILY_CATEGORIES.filter((category) => !byCategory[category]),
  }
}

function duplicatesOf(content: ContentBundle): string[] {
  const found: string[] = []
  const askedBefore = new Map<string, string>()
  for (const q of content.questions) {
    const text = normalizeWord(q.question.replace(/[^A-Za-zÀ-ú]/g, ''))
    const other = askedBefore.get(text)
    if (other) found.push(`perguntas ${other} e ${q.key} têm o mesmo enunciado`)
    askedBefore.set(text, q.key)
  }
  const byYearAndCategory = new Map<string, string[]>()
  for (const e of content.events) {
    const key = `${e.year}|${e.category}`
    byYearAndCategory.set(key, [...(byYearAndCategory.get(key) ?? []), e.key])
  }
  for (const [key, keys] of byYearAndCategory) {
    if (keys.length > 1) {
      found.push(
        `eventos ${keys.join(', ')}: mesmo ano e categoria (${key}); confira se não é o mesmo fato`,
      )
    }
  }
  return found
}

export function buildContentReport(
  content: ContentBundle,
  accepted: ReadonlySet<string>,
): ContentReport {
  const counts = {
    words: content.words.length,
    questions: content.questions.length,
    events: content.events.length,
  }
  const correctIndex: Record<string, number> = {}
  for (const q of content.questions)
    correctIndex[q.correctIndex] = (correctIndex[q.correctIndex] ?? 0) + 1
  const byDecade: Record<string, number> = {}
  for (const e of content.events) {
    const decade = `${Math.floor(e.year / 10) * 10}s`
    byDecade[decade] = (byDecade[decade] ?? 0) + 1
  }
  const nearLimit = [
    ...content.questions
      .filter((q) => q.explanation.length >= NEAR_LIMIT)
      .map((q) => `pergunta ${q.key}`),
    ...content.events
      .filter((e) => e.explanation.length >= NEAR_LIMIT)
      .map((e) => `evento ${e.key}`),
  ]
  const belowFloor = (Object.keys(CONTENT_FLOOR) as (keyof typeof CONTENT_FLOOR)[])
    .filter((bank) => counts[bank] < CONTENT_FLOOR[bank])
    .map((bank) => `${bank}: ${counts[bank]} de ${CONTENT_FLOOR[bank]}`)
  return {
    counts,
    runwayDays: {
      words: counts.words,
      questions: counts.questions,
      events: Math.floor(counts.events / 4),
    },
    belowFloor,
    words: tally(content.words),
    questions: { ...tally(content.questions), correctIndex },
    events: {
      ...tally(content.events),
      distinctYears: new Set(content.events.map((e) => e.year)).size,
      byDecade,
    },
    nearLimit,
    possibleDuplicates: duplicatesOf(content),
    errors: validateContent(content, accepted),
  }
}
