import { describe, expect, it } from 'vitest'
import { MaterializeUpcomingPuzzlesUseCase } from '../application/useCases/materializeUpcomingPuzzles'
import {
  createFakeDailyEventRepository,
  createFakeDailyPuzzleRepository,
  createFakeDailyQuestionRepository,
  createFakeDailySettingsRepository,
  createFakeDailyWordRepository,
} from '../test/fakes/fakeDailyRepositories'
import { OFFENSIVE_WORDS } from './offensiveWords'
import { readAcceptedWordsFile } from './acceptedWordsFile'
import { EXTRA_ACCEPTED_WORDS } from './extraAcceptedWords'
import {
  INITIAL_CONTENT,
  MAX_EXPLANATION_LENGTH,
  toNewEvent,
  toNewQuestion,
  toNewWord,
  validateContent,
} from './dailyContent'

const veroWords = readAcceptedWordsFile()
const accepted = new Set([...veroWords, ...EXTRA_ACCEPTED_WORDS])

describe('lista de palavras aceitas', () => {
  it('só tem palavras de 4 a 9 letras em maiúsculas sem acento, sem repetição', () => {
    expect(veroWords.length).toBeGreaterThan(500_000)
    expect(new Set(veroWords).size).toBe(veroWords.length)
    expect(veroWords.every((w) => /^[A-Z]{4,9}$/.test(w))).toBe(true)
  })

  it('está em ordem alfabética (o arquivo gerado é estável)', () => {
    expect([...veroWords].sort()).toEqual(veroWords)
  })

  it('não tem nenhuma palavra da lista de ofensivas', () => {
    const words = new Set(veroWords)
    expect(OFFENSIVE_WORDS.filter((w) => words.has(w))).toEqual([])
  })

  it('tem palavras comuns e deixa de fora entrada só com maiúscula (nome próprio)', () => {
    const words = new Set(veroWords)
    for (const common of ['JUROS', 'ACOES', 'INFLACAO', 'MERCADO', 'POUPANCA']) {
      expect(words.has(common), common).toBe(true)
    }
    // `Curitiba` consta no dicionário só com maiúscula (nome próprio): fica de fora. Já `fortaleza`
    // também é substantivo comum, então entra.
    expect(words.has('CURITIBA')).toBe(false)
    expect(words.has('FORTALEZA')).toBe(true)
  })

  it('as extras têm o formato do jogo e não repetem', () => {
    expect(EXTRA_ACCEPTED_WORDS.every((w) => /^[A-Z]{4,9}$/.test(w))).toBe(true)
    expect(new Set(EXTRA_ACCEPTED_WORDS).size).toBe(EXTRA_ACCEPTED_WORDS.length)
  })
})

describe('conteúdo inicial do Diário', () => {
  it('passa na validação: respostas aceitas, fontes, categorias, tamanhos e sem travessão', () => {
    expect(validateContent(INITIAL_CONTENT, accepted)).toEqual([])
  })

  it('tem o mínimo para 30 dias com folga', () => {
    expect(INITIAL_CONTENT.words.length).toBeGreaterThanOrEqual(250)
    expect(INITIAL_CONTENT.questions.length).toBeGreaterThanOrEqual(30)
    expect(INITIAL_CONTENT.events.length).toBeGreaterThanOrEqual(56)
  })

  it('maioria do conteúdo é sobre o Brasil em cada banco', () => {
    for (const bank of [INITIAL_CONTENT.words, INITIAL_CONTENT.questions, INITIAL_CONTENT.events]) {
      const brasil = bank.filter((item) => item.scope === 'brasil').length
      expect(brasil / bank.length).toBeGreaterThan(0.7)
    }
  })

  it('usa várias categorias em cada banco (a agenda alterna categoria entre dias)', () => {
    for (const bank of [INITIAL_CONTENT.words, INITIAL_CONTENT.questions, INITIAL_CONTENT.events]) {
      expect(new Set(bank.map((item) => item.category)).size).toBeGreaterThanOrEqual(6)
    }
  })

  it('o gabarito das perguntas varia (não fica sempre na mesma posição)', () => {
    const positions = new Set(INITIAL_CONTENT.questions.map((q) => q.correctIndex))
    expect(positions.size).toBe(4)
  })

  it('o ano de cada evento é plausível e há anos suficientes para uma Linha do tempo variada', () => {
    const years = new Set(INITIAL_CONTENT.events.map((e) => e.year))
    expect(years.size).toBeGreaterThanOrEqual(40)
    const decades = new Set(INITIAL_CONTENT.events.map((e) => Math.floor(e.year / 10)))
    expect(decades.size).toBeGreaterThanOrEqual(8)
  })

  it('recusa palavra-resposta fora da lista aceita', () => {
    const errors = validateContent(
      {
        ...INITIAL_CONTENT,
        words: [{ display: 'XPTOQ', definition: 'd', category: 'economia-geral', scope: 'brasil' }],
      },
      accepted,
    )
    expect(errors).toEqual(['palavra XPTOQ: fora da lista aceita'])
  })

  it('recusa explicação longa, fonte vazia, categoria desconhecida, nome que entrega o ano e travessão', () => {
    const q = INITIAL_CONTENT.questions[0]
    const e = INITIAL_CONTENT.events[0]
    const errors = validateContent(
      {
        words: [],
        questions: [
          {
            ...q,
            explanation: 'x'.repeat(MAX_EXPLANATION_LENGTH + 1),
            source: ' ',
            category: 'outra' as never,
          },
          { ...q, key: 'dash', question: 'Isso — aquilo?' },
        ],
        events: [{ ...e, label: `Fato de ${e.year}` }],
      },
      accepted,
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('explicação com 281 caracteres'),
        expect.stringContaining('sem fonte primária'),
        expect.stringContaining('categoria outra desconhecida'),
        expect.stringContaining('travessão'),
        expect.stringContaining('entrega o ano'),
      ]),
    )
  })

  it('as chaves estáveis não se repetem entre itens do mesmo banco', () => {
    for (const make of [
      INITIAL_CONTENT.words.map((w) => toNewWord(w).stableKey),
      INITIAL_CONTENT.questions.map((q) => toNewQuestion(q).stableKey),
      INITIAL_CONTENT.events.map((e) => toNewEvent(e).stableKey),
    ]) {
      expect(new Set(make).size).toBe(make.length)
    }
  })

  it('palavra que é termo do glossário aponta para ele; as demais não têm "saiba mais"', () => {
    const byAnswer = new Map(INITIAL_CONTENT.words.map((w) => [toNewWord(w).answer, toNewWord(w)]))
    expect(byAnswer.get('SELIC')?.learnMore).toEqual({ kind: 'glossary', ref: 'Selic' })
    expect(byAnswer.get('SPREAD')?.learnMore).toEqual({ kind: 'glossary', ref: 'spread' })
    expect(byAnswer.get('CRUZADO')?.learnMore).toBeNull()
  })
})

describe('os primeiros 30 dias materializados pela agenda', () => {
  async function run(start: string) {
    const words = createFakeDailyWordRepository(
      INITIAL_CONTENT.words.map((w, i) => ({ ...toNewWord(w), id: `w${i}` })),
    )
    const questions = createFakeDailyQuestionRepository(
      INITIAL_CONTENT.questions.map((q, i) => ({ ...toNewQuestion(q), id: `q${i}` })),
    )
    const events = createFakeDailyEventRepository(
      INITIAL_CONTENT.events.map((e, i) => ({ ...toNewEvent(e), id: `e${i}` })),
    )
    const puzzles = createFakeDailyPuzzleRepository()
    const useCase = new MaterializeUpcomingPuzzlesUseCase(
      createFakeDailySettingsRepository(start),
      words,
      questions,
      events,
      puzzles,
      () => new Date('2026-11-01T12:00:00Z'),
    )
    const result = await useCase.execute()
    return { result, puzzles, words, questions, events }
  }

  it('gera os 30 jogos sem nenhum aviso', async () => {
    const { result, puzzles } = await run('2026-11-10')
    expect(result.created).toHaveLength(30)
    expect(result.warnings).toEqual([])
    expect(puzzles.items).toHaveLength(30)
  })

  it('nenhuma palavra, pergunta ou evento se repete nos 30 dias', async () => {
    const { puzzles } = await run('2026-11-10')
    const wordIds = puzzles.items.map((p) => p.wordId)
    const questionIds = puzzles.items.map((p) => p.questionId)
    expect(new Set(wordIds).size).toBe(30)
    expect(new Set(questionIds).size).toBe(30)
    // Eventos só não repetem dentro da janela de 14 dias (DEFAULT_WINDOWS); 67 eventos cobrem
    // 16 dias sem repetir, e depois disso o mesmo evento volta numa Linha do tempo nova.
    const sorted = [...puzzles.items].sort((a, b) => a.number - b.number)
    for (let i = 0; i + 15 <= sorted.length; i++) {
      const ids = sorted.slice(i, i + 15).flatMap((p) => p.timelineEventIds)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('cada Linha do tempo tem 4 eventos de anos diferentes e mistura décadas e categorias', async () => {
    const { puzzles, events } = await run('2026-11-10')
    const byId = new Map(events.items.map((e) => [e.id, e]))
    for (const p of puzzles.items) {
      const timeline = p.timelineEventIds.map((id) => byId.get(id)!)
      expect(timeline).toHaveLength(4)
      expect(new Set(timeline.map((e) => e.year)).size).toBe(4)
      expect(new Set(timeline.map((e) => Math.floor(e.year / 10))).size).toBeGreaterThanOrEqual(3)
      expect(new Set(timeline.map((e) => e.category)).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('não repete categoria em dias seguidos na palavra e na pergunta (quando há alternativa)', async () => {
    const { puzzles, words, questions } = await run('2026-11-10')
    const wordCat = new Map(words.items.map((w) => [w.id, w.category]))
    const questionCat = new Map(questions.items.map((q) => [q.id, q.category]))
    const sorted = [...puzzles.items].sort((a, b) => a.number - b.number)
    for (let i = 1; i < sorted.length; i++) {
      expect(wordCat.get(sorted[i].wordId)).not.toBe(wordCat.get(sorted[i - 1].wordId))
      expect(questionCat.get(sorted[i].questionId)).not.toBe(
        questionCat.get(sorted[i - 1].questionId),
      )
    }
  })

  it('a maioria de cada semana é sobre o Brasil', async () => {
    const { puzzles, words, questions } = await run('2026-11-10')
    const wordScope = new Map(words.items.map((w) => [w.id, w.scope]))
    const questionScope = new Map(questions.items.map((q) => [q.id, q.scope]))
    const sorted = [...puzzles.items].sort((a, b) => a.number - b.number)
    for (let i = 0; i + 7 <= sorted.length; i++) {
      const week = sorted.slice(i, i + 7)
      expect(week.filter((p) => wordScope.get(p.wordId) === 'fora').length).toBeLessThanOrEqual(3)
      expect(
        week.filter((p) => questionScope.get(p.questionId) === 'fora').length,
      ).toBeLessThanOrEqual(3)
    }
  })
})
