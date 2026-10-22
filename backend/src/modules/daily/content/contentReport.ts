import { normalizeWord } from '../domain/wordGuess'
import { DAILY_CATEGORIES } from './categories'
import { MAX_EXPLANATION_LENGTH, validateContent, type ContentBundle } from './dailyContent'

// Relatório do estoque de conteúdo do Diário, usado pela skill `diario-conteudo` para decidir o que
// criar e para conferir o resultado. Só leitura: não grava nada e não substitui `validateContent`
// (que é o portão), apenas mostra o estado e aponta lacunas e possíveis duplicatas.

// Mínimos que os testes de `dailyContent.test.ts` já exigem do conteúdo inicial.
export const CONTENT_FLOOR = { words: 250, questions: 30 } as const

// Quanto da explicação já é "quase no teto": o painel de edição pode estourar ao ajustar.
const NEAR_LIMIT = MAX_EXPLANATION_LENGTH - 30

interface Tallied {
  total: number
  brasilShare: number
  byCategory: Record<string, number>
  emptyCategories: string[]
}

export interface ContentReport {
  counts: { words: number; questions: number }
  // Dias de agenda que o banco sustenta sem repetir item: uma palavra e uma pergunta por dia.
  runwayDays: { words: number; questions: number }
  belowFloor: string[]
  words: Tallied
  questions: Tallied & { correctIndex: Record<string, number> }
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
  return found
}

export function buildContentReport(
  content: ContentBundle,
  accepted: ReadonlySet<string>,
): ContentReport {
  const counts = {
    words: content.words.length,
    questions: content.questions.length,
  }
  const correctIndex: Record<string, number> = {}
  for (const q of content.questions)
    correctIndex[q.correctIndex] = (correctIndex[q.correctIndex] ?? 0) + 1
  const nearLimit = content.questions
    .filter((q) => q.explanation.length >= NEAR_LIMIT)
    .map((q) => `pergunta ${q.key}`)
  const belowFloor = (Object.keys(CONTENT_FLOOR) as (keyof typeof CONTENT_FLOOR)[])
    .filter((bank) => counts[bank] < CONTENT_FLOOR[bank])
    .map((bank) => `${bank}: ${counts[bank]} de ${CONTENT_FLOOR[bank]}`)
  return {
    counts,
    runwayDays: { words: counts.words, questions: counts.questions },
    belowFloor,
    words: tally(content.words),
    questions: { ...tally(content.questions), correctIndex },
    nearLimit,
    possibleDuplicates: duplicatesOf(content),
    errors: validateContent(content, accepted),
  }
}
