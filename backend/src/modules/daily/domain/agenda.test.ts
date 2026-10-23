import { describe, expect, it } from 'vitest'
import { planDay, type ScheduledDay } from './agenda'
import type { DailyQuestion, DailyWord } from './content'

const word = (
  id: string,
  category: string,
  scope: 'brasil' | 'fora' = 'brasil',
  active = true,
): DailyWord => ({
  id,
  stableKey: id,
  answer: id.toUpperCase().padEnd(4, 'X'),
  display: id,
  definition: 'd',
  learnMore: null,
  category,
  scope,
  active,
})

const question = (
  id: string,
  category: string,
  scope: 'brasil' | 'fora' = 'brasil',
  active = true,
): DailyQuestion => ({
  id,
  stableKey: id,
  question: 'q',
  options: ['a', 'b'],
  correctIndex: 0,
  explanation: 'e',
  sourceRef: 'BCB',
  learnMore: null,
  category,
  scope,
  reviewedAt: null,
  active,
})

const words = Array.from({ length: 10 }, (_, i) => word(`w${i}`, `cat${i % 3}`))
const questions = Array.from({ length: 10 }, (_, i) => question(`q${i}`, `cat${i % 3}`))

const day = (date: string, over: Partial<ScheduledDay> = {}): ScheduledDay => ({
  date,
  wordId: 'x',
  wordCategory: null,
  wordScope: null,
  questionId: 'y',
  questionCategory: null,
  questionScope: null,
  ...over,
})

const plan = (date: string, over: Partial<Parameters<typeof planDay>[0]> = {}) =>
  planDay({ date, words, questions, history: [], ...over })

describe('planDay', () => {
  it('mesma entrada => mesmo plano; datas diferentes => planos diferentes', () => {
    const a = plan('2026-11-03')
    expect(plan('2026-11-03')).toEqual(a)
    const plans = new Set<string>()
    for (let d = 1; d <= 20; d++) {
      plans.add(JSON.stringify(plan(`2026-11-${String(d).padStart(2, '0')}`).plan))
    }
    expect(plans.size).toBeGreaterThan(15)
  })

  it('a pergunta não depende da data do calendário: qualquer dia tem pergunta', () => {
    for (const date of [
      '2026-02-29'.replace('29', '28'),
      '2026-07-01',
      '2026-12-31',
      '2027-01-01',
    ]) {
      expect(plan(date).plan?.questionId).toBeTruthy()
    }
  })

  it('palavra não repete dentro da janela, nos dois lados', () => {
    const two = [word('a1', 'x'), word('b1', 'y')]
    const history = [day('2026-11-01', { wordId: 'a1' }), day('2026-11-05', { wordId: 'b1' })]
    const result = plan('2026-11-03', { words: two, history })
    expect(result.plan).toBeNull()
    expect(result.warnings).toContain('no_word_available')
  })

  it('fora da janela a palavra volta a valer', () => {
    const one = [word('a1', 'x')]
    expect(
      plan('2026-11-03', { words: one, history: [day('2025-10-01', { wordId: 'a1' })] }).plan
        ?.wordId,
    ).toBe('a1')
    expect(
      plan('2026-11-03', { words: one, history: [day('2026-10-01', { wordId: 'a1' })] }).plan,
    ).toBeNull()
  })

  it('pergunta não repete dentro da janela', () => {
    const only = [question('q1', 'a')]
    const used = plan('2026-11-03', {
      questions: only,
      history: [day('2026-06-01', { questionId: 'q1' })],
    })
    expect(used.plan).toBeNull()
    expect(used.warnings).toContain('no_question_available')
    const old = plan('2026-11-03', {
      questions: only,
      history: [day('2025-06-01', { questionId: 'q1' })],
    })
    expect(old.plan?.questionId).toBe('q1')
  })

  it('variedade: evita a categoria do dia anterior e do seguinte quando há alternativa', () => {
    const cats = [word('a1', 'juros'), word('b1', 'juros'), word('c1', 'crise')]
    const qs = [question('q1', 'juros'), question('q2', 'juros'), question('q3', 'crise')]
    for (let d = 2; d <= 25; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`
      const previous = `2026-11-${String(d - 1).padStart(2, '0')}`
      const history = [day(previous, { wordCategory: 'juros', questionCategory: 'juros' })]
      const result = plan(date, { words: cats, questions: qs, history })
      expect(result.plan?.wordId).toBe('c1')
      expect(result.plan?.questionId).toBe('q3')
    }
  })

  it('variedade é só preferência: sem alternativa, repete a categoria', () => {
    const result = plan('2026-11-03', {
      words: [word('a1', 'juros')],
      history: [day('2026-11-02', { wordCategory: 'juros' })],
    })
    expect(result.plan?.wordId).toBe('a1')
  })

  it('maioria do Brasil: com 3 "fora" nos 6 dias anteriores, só Brasil (palavra e pergunta)', () => {
    const mixW = [word('f1', 'a', 'fora'), word('f2', 'b', 'fora'), word('b1', 'c', 'brasil')]
    const mixQ = [question('f1', 'a', 'fora'), question('b1', 'c', 'brasil')]
    const history = ['2026-11-01', '2026-11-02', '2026-11-03'].map((date) =>
      day(date, { wordScope: 'fora', questionScope: 'fora' }),
    )
    for (let d = 4; d <= 7; d++) {
      const result = plan(`2026-11-0${d}`, { words: mixW, questions: mixQ, history })
      expect(result.plan?.wordId).toBe('b1')
      expect(result.plan?.questionId).toBe('b1')
      expect(result.warnings).not.toContain('scope_rule_relaxed')
    }
  })

  it('maioria do Brasil: sem candidato do Brasil, relaxa e avisa', () => {
    const history = ['2026-11-01', '2026-11-02', '2026-11-03'].map((date) =>
      day(date, { questionScope: 'fora' }),
    )
    const result = plan('2026-11-04', { questions: [question('f1', 'a', 'fora')], history })
    expect(result.plan?.questionId).toBe('f1')
    expect(result.warnings).toContain('scope_rule_relaxed')
  })

  it('"fora" ainda entra quando a semana tem folga', () => {
    const history = [day('2026-11-02', { wordScope: 'fora' })]
    expect(plan('2026-11-03', { words: [word('f1', 'a', 'fora')], history }).plan?.wordId).toBe(
      'f1',
    )
  })

  it('banco vazio gera aviso por cartão, nunca um plano', () => {
    const empty = plan('2026-11-03', { words: [], questions: [] })
    expect(empty.plan).toBeNull()
    expect(empty.warnings).toEqual(['no_word_available', 'no_question_available'])
  })

  it('itens inativos nunca entram', () => {
    expect(plan('2026-11-03', { words: [word('a1', 'x', 'brasil', false)] }).plan).toBeNull()
    expect(
      plan('2026-11-03', { questions: [question('q1', 'x', 'brasil', false)] }).plan,
    ).toBeNull()
  })
})
