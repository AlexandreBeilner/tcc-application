import { describe, expect, it } from 'vitest'
import { planDay, type ScheduledDay } from './agenda'
import type { DailyFact, DailyWord } from './content'

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

const fact = (
  id: string,
  eventDate: string,
  category = 'moeda',
  scope: 'brasil' | 'fora' = 'brasil',
  label: string | null = id,
): DailyFact => ({
  id,
  stableKey: id,
  eventDate,
  question: 'q',
  options: ['a', 'b'],
  correctIndex: 0,
  explanation: 'e',
  timelineLabel: label,
  sourceRef: 'BCB',
  learnMore: null,
  category,
  scope,
  reviewedAt: null,
  active: true,
})

// 40 fatos em 40 anos distintos, categorias alternadas, para a Linha do tempo sempre ter de onde sortear.
const bank = Array.from({ length: 40 }, (_, i) =>
  fact(
    `f${String(i).padStart(2, '0')}`,
    `${1960 + i}-${String((i % 12) + 1).padStart(2, '0')}-10`,
    `cat${i % 4}`,
  ),
)
const words = Array.from({ length: 10 }, (_, i) => word(`w${i}`, `cat${i % 3}`))

const day = (date: string, over: Partial<ScheduledDay> = {}): ScheduledDay => ({
  date,
  wordId: 'x',
  wordCategory: null,
  wordScope: null,
  factId: 'y',
  factCategory: null,
  factScope: null,
  timelineFactIds: [],
  ...over,
})

describe('planDay', () => {
  it('mesma entrada => mesmo plano; datas diferentes => planos diferentes', () => {
    const a = planDay({ date: '2026-11-03', words, facts: bank, history: [] })
    expect(planDay({ date: '2026-11-03', words, facts: bank, history: [] })).toEqual(a)
    const plans = new Set<string>()
    for (let d = 1; d <= 20; d++) {
      plans.add(
        JSON.stringify(
          planDay({
            date: `2026-11-${String(d).padStart(2, '0')}`,
            words,
            facts: bank,
            history: [],
          }).plan,
        ),
      )
    }
    expect(plans.size).toBeGreaterThan(15)
  })

  it('o fato do dia e mês exatos tem prioridade, sem aviso', () => {
    const facts = [fact('a', '1994-07-01'), fact('b', '1990-03-15'), ...bank]
    const { plan, warnings } = planDay({ date: '2026-07-01', words, facts, history: [] })
    expect(plan?.factId).toBe('a')
    expect(warnings).not.toContain('on_this_day_not_exact')
  })

  it('sem fato exato, usa o mais próximo no calendário e avisa', () => {
    const facts = [
      fact('perto', '1994-07-03'),
      fact('longe', '1990-01-15'),
      ...bank.slice(0, 10).map((f, i) => ({ ...f, eventDate: `${1960 + i}-12-25` })),
    ]
    const { plan, warnings } = planDay({ date: '2026-07-01', words, facts, history: [] })
    expect(plan?.factId).toBe('perto')
    expect(warnings).toContain('on_this_day_not_exact')
  })

  it('a distância no calendário é circular (31/12 está perto de 02/01)', () => {
    const facts = [fact('virada', '1999-12-31'), fact('meio', '1990-07-01'), ...bank]
    const { plan } = planDay({
      date: '2026-01-02',
      words,
      facts: facts.filter((f) => f.id === 'virada' || f.id === 'meio' || f.timelineLabel),
      history: [],
    })
    expect(plan?.factId).toBe('virada')
  })

  it('palavra não repete dentro da janela, nos dois lados', () => {
    const two = [word('a1', 'x'), word('b1', 'y')]
    const history = [day('2026-11-01', { wordId: 'a1' }), day('2026-11-05', { wordId: 'b1' })]
    const { plan, warnings } = planDay({ date: '2026-11-03', words: two, facts: bank, history })
    expect(plan).toBeNull()
    expect(warnings).toContain('no_word_available')
  })

  it('fora da janela a palavra volta a valer', () => {
    const one = [word('a1', 'x')]
    const history = [day('2025-10-01', { wordId: 'a1' })]
    expect(planDay({ date: '2026-11-03', words: one, facts: bank, history }).plan?.wordId).toBe(
      'a1',
    )
    expect(
      planDay({
        date: '2026-11-03',
        words: one,
        facts: bank,
        history: [day('2026-10-01', { wordId: 'a1' })],
      }).plan,
    ).toBeNull()
  })

  it('fato do Neste dia não repete na janela; o da Linha do tempo tem janela menor', () => {
    const facts = [fact('a', '1994-07-01'), ...bank]
    const used = planDay({
      date: '2026-07-01',
      words,
      facts,
      history: [day('2026-06-01', { factId: 'a' })],
    })
    expect(used.plan?.factId).not.toBe('a')

    const timelineIds = bank.map((f) => f.id)
    const recent = planDay({
      date: '2026-11-10',
      words,
      facts: bank,
      history: [day('2026-11-09', { timelineFactIds: timelineIds })],
    })
    expect(recent.plan).toBeNull()
    expect(recent.warnings).toContain('no_timeline_available')
    const old = planDay({
      date: '2026-11-30',
      words,
      facts: bank,
      history: [day('2026-11-09', { timelineFactIds: timelineIds })],
    })
    expect(old.plan).not.toBeNull()
  })

  it('a Linha do tempo nunca repete o fato do Neste dia e sempre tem 4 anos distintos', () => {
    for (let d = 1; d <= 28; d++) {
      const date = `2026-02-${String(d).padStart(2, '0')}`
      const { plan } = planDay({ date, words, facts: bank, history: [] })
      expect(plan!.timelineFactIds).not.toContain(plan!.factId)
      const years = plan!.timelineFactIds.map((id) =>
        bank.find((f) => f.id === id)!.eventDate.slice(0, 4),
      )
      expect(new Set(years).size).toBe(4)
    }
  })

  it('fato sem nome curto não entra na Linha do tempo', () => {
    const mixed = bank.map((f, i) => (i % 2 === 0 ? { ...f, timelineLabel: null } : f))
    const { plan } = planDay({ date: '2026-11-03', words, facts: mixed, history: [] })
    for (const id of plan!.timelineFactIds)
      expect(mixed.find((f) => f.id === id)!.timelineLabel).not.toBeNull()
  })

  it('variedade: evita a categoria do dia anterior e do seguinte quando há alternativa', () => {
    const cats = [word('a1', 'juros'), word('b1', 'juros'), word('c1', 'crise')]
    for (let d = 1; d <= 25; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`
      const history = [
        day(`2026-11-${String(d - 1 || 30).padStart(2, '0')}`.replace('2026-11-30', '2026-10-31'), {
          wordCategory: 'juros',
        }),
      ]
      const { plan } = planDay({ date, words: cats, facts: bank, history })
      expect(plan?.wordId).toBe('c1')
    }
  })

  it('variedade é só preferência: sem alternativa, repete a categoria', () => {
    const only = [word('a1', 'juros')]
    const { plan } = planDay({
      date: '2026-11-03',
      words: only,
      facts: bank,
      history: [day('2026-11-02', { wordCategory: 'juros' })],
    })
    expect(plan?.wordId).toBe('a1')
  })

  it('maioria do Brasil: com 3 "fora" nos 6 dias anteriores, só Brasil', () => {
    const mix = [word('f1', 'a', 'fora'), word('f2', 'b', 'fora'), word('b1', 'c', 'brasil')]
    const history = ['2026-11-01', '2026-11-02', '2026-11-03'].map((date) =>
      day(date, { wordScope: 'fora' }),
    )
    for (let d = 4; d <= 7; d++) {
      const { plan, warnings } = planDay({
        date: `2026-11-0${d}`,
        words: mix,
        facts: bank,
        history,
      })
      expect(plan?.wordId).toBe('b1')
      expect(warnings).not.toContain('scope_rule_relaxed')
    }
  })

  it('maioria do Brasil: sem candidato do Brasil, relaxa e avisa', () => {
    const fora = [word('f1', 'a', 'fora')]
    const history = ['2026-11-01', '2026-11-02', '2026-11-03'].map((date) =>
      day(date, { wordScope: 'fora' }),
    )
    const { plan, warnings } = planDay({ date: '2026-11-04', words: fora, facts: bank, history })
    expect(plan?.wordId).toBe('f1')
    expect(warnings).toContain('scope_rule_relaxed')
  })

  it('"fora" ainda entra quando a semana tem folga', () => {
    const fora = [word('f1', 'a', 'fora')]
    const history = [day('2026-11-02', { wordScope: 'fora' })]
    expect(planDay({ date: '2026-11-03', words: fora, facts: bank, history }).plan?.wordId).toBe(
      'f1',
    )
  })

  it('banco vazio gera aviso por cartão, nunca um plano', () => {
    const empty = planDay({ date: '2026-11-03', words: [], facts: [], history: [] })
    expect(empty.plan).toBeNull()
    expect(empty.warnings).toEqual([
      'no_word_available',
      'no_fact_available',
      'no_timeline_available',
    ])
  })

  it('itens inativos nunca entram', () => {
    const { plan } = planDay({
      date: '2026-11-03',
      words: [word('a1', 'x', 'brasil', false)],
      facts: bank,
      history: [],
    })
    expect(plan).toBeNull()
  })
})
