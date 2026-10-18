import { normalizeWord } from '../domain/wordGuess'
import type { DailyEvent, DailyQuestion, DailyWord, LearnMore } from '../domain/content'
import { DAILY_CATEGORIES } from './categories'
import { GLOSSARY_KEYS } from './glossaryRefs'
import { EVENT_SEEDS, type EventSeed } from './events'
import { QUESTION_SEEDS, type QuestionSeed } from './questions'
import { WORD_SEEDS, type WordSeed } from './words'

// Teto de texto da explicação de pergunta e de evento (checklist 3.3, item 5).
export const MAX_EXPLANATION_LENGTH = 280

const GLOSSARY_BY_NORMALIZED = new Map(GLOSSARY_KEYS.map((key) => [normalizeWord(key), key]))

function learnMoreFor(display: string): LearnMore | null {
  const key = GLOSSARY_BY_NORMALIZED.get(normalizeWord(display))
  return key ? { kind: 'glossary', ref: key } : null
}

// Chaves estáveis por banco: `w:` palavra, `q:` pergunta, `e:` evento. Atribuídas uma vez e nunca
// mais alteradas (o seed importa por elas e nunca sobrescreve o que o painel editou).
export function wordStableKey(seed: WordSeed): string {
  return `w:${normalizeWord(seed.display).toLowerCase()}`
}

type NewWord = Omit<DailyWord, 'id'>
type NewQuestion = Omit<DailyQuestion, 'id'>
type NewEvent = Omit<DailyEvent, 'id'>

export function toNewWord(seed: WordSeed): NewWord {
  return {
    stableKey: wordStableKey(seed),
    answer: normalizeWord(seed.display),
    display: seed.display,
    definition: seed.definition,
    learnMore: learnMoreFor(seed.display),
    category: seed.category,
    scope: seed.scope,
    active: true,
  }
}

export function toNewQuestion(seed: QuestionSeed): NewQuestion {
  return {
    stableKey: `q:${seed.key}`,
    question: seed.question,
    options: [...seed.options],
    correctIndex: seed.correctIndex,
    explanation: seed.explanation,
    sourceRef: seed.source,
    learnMore: null,
    category: seed.category,
    scope: seed.scope,
    // O conteúdo nasce sem revisão: quem revisa é o autor, pelo painel (DI.5.1).
    reviewedAt: null,
    active: true,
  }
}

export function toNewEvent(seed: EventSeed): NewEvent {
  return {
    stableKey: `e:${seed.key}`,
    year: seed.year,
    label: seed.label,
    explanation: seed.explanation,
    sourceRef: seed.source,
    learnMore: null,
    category: seed.category,
    scope: seed.scope,
    reviewedAt: null,
    active: true,
  }
}

export interface ContentBundle {
  words: readonly WordSeed[]
  questions: readonly QuestionSeed[]
  events: readonly EventSeed[]
}

export const INITIAL_CONTENT: ContentBundle = {
  words: WORD_SEEDS,
  questions: QUESTION_SEEDS,
  events: EVENT_SEEDS,
}

const categories: readonly string[] = DAILY_CATEGORIES

// Confere o conteúdo antes de gravar. Devolve uma mensagem por problema (lista vazia = válido).
// `accepted` é a lista de palavras aceitas (VERO e extras): toda resposta precisa estar nela.
export function validateContent(content: ContentBundle, accepted: ReadonlySet<string>): string[] {
  const errors: string[] = []
  const dash = /—/
  const seen = (label: string) => {
    const keys = new Set<string>()
    return (key: string) => {
      if (keys.has(key)) errors.push(`${label} repetido: ${key}`)
      keys.add(key)
    }
  }

  const checkWord = seen('palavra')
  for (const w of content.words) {
    const answer = normalizeWord(w.display)
    checkWord(answer)
    if (!/^[A-Z]{4,9}$/.test(answer))
      errors.push(`palavra ${w.display}: precisa ter de 4 a 9 letras`)
    if (!accepted.has(answer)) errors.push(`palavra ${w.display}: fora da lista aceita`)
    if (!categories.includes(w.category))
      errors.push(`palavra ${w.display}: categoria ${w.category} desconhecida`)
    if (w.definition.trim().length === 0) errors.push(`palavra ${w.display}: sem definição`)
    if (dash.test(w.definition)) errors.push(`palavra ${w.display}: travessão no texto`)
  }

  const checkQuestion = seen('pergunta')
  for (const q of content.questions) {
    checkQuestion(q.key)
    if (!categories.includes(q.category))
      errors.push(`pergunta ${q.key}: categoria ${q.category} desconhecida`)
    if (q.source.trim().length === 0) errors.push(`pergunta ${q.key}: sem fonte primária`)
    if (q.explanation.length > MAX_EXPLANATION_LENGTH) {
      errors.push(`pergunta ${q.key}: explicação com ${q.explanation.length} caracteres`)
    }
    if (new Set(q.options).size !== q.options.length)
      errors.push(`pergunta ${q.key}: alternativas repetidas`)
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length)
      errors.push(`pergunta ${q.key}: gabarito fora das alternativas`)
    for (const text of [q.question, q.explanation, ...q.options]) {
      if (dash.test(text)) errors.push(`pergunta ${q.key}: travessão no texto`)
    }
  }

  const checkEvent = seen('evento')
  for (const e of content.events) {
    checkEvent(e.key)
    if (!categories.includes(e.category))
      errors.push(`evento ${e.key}: categoria ${e.category} desconhecida`)
    if (e.source.trim().length === 0) errors.push(`evento ${e.key}: sem fonte primária`)
    if (e.explanation.length > MAX_EXPLANATION_LENGTH) {
      errors.push(`evento ${e.key}: explicação com ${e.explanation.length} caracteres`)
    }
    if (e.label.length > 80) errors.push(`evento ${e.key}: nome curto com mais de 80 caracteres`)
    // O nome mostrado antes de ordenar não pode entregar o ano.
    if (e.label.includes(String(e.year))) errors.push(`evento ${e.key}: o nome entrega o ano`)
    for (const text of [e.label, e.explanation]) {
      if (dash.test(text)) errors.push(`evento ${e.key}: travessão no texto`)
    }
  }
  return errors
}
