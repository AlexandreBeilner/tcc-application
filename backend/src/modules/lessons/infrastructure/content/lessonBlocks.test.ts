import { describe, expect, it } from 'vitest'
import { lessonBlocksSchema, parseLessonBlocks } from './lessonBlocks'

// Mesmo exemplo do teste de contrato do frontend
// (`features/lessons/widgets/schema/index.test.ts`): se um dos dois lados mudar
// o contrato sem o outro, um deles quebra.
export const CONTRACT_EXAMPLE = {
  schemaVersion: 1,
  phases: {
    scenario: [
      { type: 'text', markup: 'Você tem R$ 1.000 parados.' },
      {
        type: 'widget',
        id: 'dica-1',
        widget: 'callout',
        props: {
          tone: 'tip',
          title: 'Juros compostos',
          body: 'Juros sobre juros.',
          formula: 'M = C x (1 + i)^n',
        },
      },
    ],
    microDecision: [
      { type: 'widget', id: 'calc', widget: 'growth-calculator', props: {} },
      {
        type: 'check',
        id: 'q1',
        kind: 'single',
        prompt: 'Qual rende mais?',
        options: ['LCI', 'CDB'],
        answer: 1,
        explanation: 'O CDB líquido vence.',
      },
      {
        type: 'check',
        id: 'q2',
        kind: 'true_false',
        prompt: 'LCI paga IR?',
        answer: false,
        explanation: 'Isenta.',
      },
      {
        type: 'check',
        id: 'q3',
        kind: 'numeric',
        prompt: 'Taxa bruta equivalente?',
        answer: 12.26,
        tolerance: 0.05,
        unit: '%',
        explanation: '9,50 / 0,775.',
      },
    ],
    revelation: [
      {
        type: 'widget',
        id: 'ind',
        widget: 'live-indicator',
        props: { ticker: 'VALR3' },
        caption: 'Indicadores de hoje',
      },
      { type: 'widget', id: 'macro', widget: 'live-macro', props: { windowDays: 90 } },
      {
        type: 'widget',
        id: 'nota-copom',
        widget: 'platform-note',
        props: {
          brazil: 'O Copom se reúne 8 vezes por ano.',
          here: 'As reuniões acontecem a cada 45 dias simulados.',
          why: 'O tempo corre mais rápido para você ver o efeito dos juros.',
        },
      },
    ],
  },
}

describe('lessonBlocksSchema', () => {
  it('aceita o exemplo do contrato', () => {
    expect(lessonBlocksSchema.safeParse(CONTRACT_EXAMPLE).success).toBe(true)
  })

  it('aceita os widgets de renda fixa com defaults', () => {
    const phases = {
      ...CONTRACT_EXAMPLE.phases,
      scenario: [
        { type: 'widget', id: 'a', widget: 'equivalent-rate', props: {} },
        { type: 'widget', id: 'b', widget: 'ir-regressive-table', props: { grossYield: 500 } },
        {
          type: 'widget',
          id: 'c',
          widget: 'product-comparator',
          props: {
            products: [
              { name: 'CDB', annualRatePct: 12, taxExempt: false },
              { name: 'LCI', annualRatePct: 9.5, taxExempt: true },
            ],
          },
        },
      ],
    }
    expect(lessonBlocksSchema.safeParse({ ...CONTRACT_EXAMPLE, phases }).success).toBe(true)
  })

  it('aceita os widgets de juros e inflação com defaults', () => {
    const phases = {
      ...CONTRACT_EXAMPLE.phases,
      scenario: [
        { type: 'widget', id: 'a', widget: 'compound-growth', props: {} },
        { type: 'widget', id: 'b', widget: 'real-return', props: { inflationPct: 6 } },
        { type: 'widget', id: 'c', widget: 'selic-ipca-chart', props: { windowDays: 180 } },
        { type: 'widget', id: 'd', widget: 'copom-timeline', props: {} },
        { type: 'widget', id: 'e', widget: 'inflation-selic-seesaw', props: { inflationPct: 7 } },
        {
          type: 'widget',
          id: 'f',
          widget: 'emergency-fund-calculator',
          props: { monthlyCost: 4000, incomeType: 'variable' },
        },
        { type: 'widget', id: 'g', widget: 'where-to-keep', props: {} },
        { type: 'widget', id: 'h', widget: 'mtm-seesaw', props: { indexer: 'ipca-plus', yearsToMaturity: 5 } },
        { type: 'widget', id: 'i', widget: 'fgc-coverage-bar', props: { institutions: 3, sameConglomerate: true } },
        { type: 'widget', id: 'j', widget: 'rating-ruler', props: { highlight: 'BBB' } },
        { type: 'widget', id: 'k', widget: 'bond-price-calculator', props: { ratePct: 10, years: 1 } },
        { type: 'widget', id: 'l', widget: 'ipca-plus-simulator', props: { years: 10, ipcaPct: 4 } },
        { type: 'widget', id: 'm', widget: 'breakeven-inflation', props: { prefixedPct: 13, realPct: 7 } },
        { type: 'widget', id: 'n', widget: 'ownership-calculator', props: { yourShares: 50, payoutPct: 40 } },
        { type: 'widget', id: 'o', widget: 'bookbuilding-simulator', props: { offeredShares: 500000, primaryPct: 100 } },
        { type: 'widget', id: 'p', widget: 'ticker-decoder', props: {} },
        { type: 'widget', id: 'q', widget: 'headline-triage', props: {} },
        { type: 'widget', id: 'r', widget: 'order-book', props: {} },
      ],
    }
    expect(lessonBlocksSchema.safeParse({ ...CONTRACT_EXAMPLE, phases }).success).toBe(true)
  })

  it.each([
    ['compound-growth', { months: 0 }],
    ['compound-growth', { rateUnit: 'day' }],
    ['real-return', { inflationPct: 50 }],
    ['selic-ipca-chart', { windowDays: 3 }],
    ['inflation-selic-seesaw', { inflationPct: 40 }],
    ['emergency-fund-calculator', { incomeType: 'rico' }],
    ['mtm-seesaw', { indexer: 'cdi' }],
    ['fgc-coverage-bar', { institutions: 9 }],
    ['rating-ruler', { highlight: 'ZZ' }],
    ['bond-price-calculator', { ratePct: 40 }],
    ['ipca-plus-simulator', { years: 2.5 }],
    ['breakeven-inflation', { realPct: 1 }],
    ['ownership-calculator', { payoutPct: 150 }],
    ['bookbuilding-simulator', { primaryPct: -1 }],
    ['order-book', { levels: 3 }],
  ])('%s com props fora do limite é rejeitado', (widget, props) => {
    const phases = {
      ...CONTRACT_EXAMPLE.phases,
      scenario: [{ type: 'widget', id: 'x', widget, props }],
    }
    expect(lessonBlocksSchema.safeParse({ ...CONTRACT_EXAMPLE, phases }).success).toBe(false)
  })

  it('comparador com um produto só é rejeitado', () => {
    const phases = {
      ...CONTRACT_EXAMPLE.phases,
      scenario: [
        {
          type: 'widget',
          id: 'c',
          widget: 'product-comparator',
          props: { products: [{ name: 'CDB', annualRatePct: 12, taxExempt: false }] },
        },
      ],
    }
    expect(lessonBlocksSchema.safeParse({ ...CONTRACT_EXAMPLE, phases }).success).toBe(false)
  })

  it.each([
    ['sem a linha Por quê', { brazil: 'a', here: 'b' }],
    ['linha vazia', { brazil: 'a', here: '', why: 'c' }],
  ])('platform-note %s é rejeitada', (_name, props) => {
    const bad = {
      ...CONTRACT_EXAMPLE,
      phases: {
        ...CONTRACT_EXAMPLE.phases,
        scenario: [{ type: 'widget', id: 'n', widget: 'platform-note', props }],
      },
    }
    expect(lessonBlocksSchema.safeParse(bad).success).toBe(false)
  })

  it.each([
    [
      'single com answer fora das options',
      {
        type: 'check',
        id: 'x',
        kind: 'single',
        prompt: 'p',
        options: ['a', 'b'],
        answer: 2,
        explanation: 'e',
      },
    ],
    [
      'single com uma alternativa só',
      {
        type: 'check',
        id: 'x',
        kind: 'single',
        prompt: 'p',
        options: ['a'],
        answer: 0,
        explanation: 'e',
      },
    ],
    [
      'check sem explicação',
      { type: 'check', id: 'x', kind: 'true_false', prompt: 'p', answer: true },
    ],
    [
      'numérica com tolerância negativa',
      {
        type: 'check',
        id: 'x',
        kind: 'numeric',
        prompt: 'p',
        answer: 1,
        tolerance: -1,
        explanation: 'e',
      },
    ],
  ])('rejeita check inválido: %s', (_name, check) => {
    const blocks = {
      schemaVersion: 1,
      phases: { scenario: [check], microDecision: [], revelation: [] },
    }
    expect(lessonBlocksSchema.safeParse(blocks).success).toBe(false)
  })

  it('rejeita mais de 7 checkpoints por lição', () => {
    const checks = Array.from({ length: 8 }, (_, i) => ({
      type: 'check',
      id: `q${i}`,
      kind: 'true_false',
      prompt: 'p',
      answer: true,
      explanation: 'e',
    }))
    expect(
      lessonBlocksSchema.safeParse({
        schemaVersion: 1,
        phases: { scenario: checks, microDecision: [], revelation: [] },
      }).success,
    ).toBe(false)
    expect(
      lessonBlocksSchema.safeParse({
        schemaVersion: 1,
        phases: { scenario: checks.slice(0, 7), microDecision: [], revelation: [] },
      }).success,
    ).toBe(true)
  })

  it.each([
    ['versão desconhecida', { ...CONTRACT_EXAMPLE, schemaVersion: 2 }],
    ['fase faltando', { schemaVersion: 1, phases: { scenario: [], microDecision: [] } }],
    [
      'widget fora do registro',
      {
        schemaVersion: 1,
        phases: {
          scenario: [{ type: 'widget', id: 'x', widget: 'nao-existe', props: {} }],
          microDecision: [],
          revelation: [],
        },
      },
    ],
    [
      'props inválidas',
      {
        schemaVersion: 1,
        phases: {
          scenario: [{ type: 'widget', id: 'x', widget: 'live-indicator', props: {} }],
          microDecision: [],
          revelation: [],
        },
      },
    ],
    [
      'props a mais em widget sem configuração',
      {
        schemaVersion: 1,
        phases: {
          scenario: [{ type: 'widget', id: 'x', widget: 'growth-calculator', props: { a: 1 } }],
          microDecision: [],
          revelation: [],
        },
      },
    ],
    [
      'texto vazio',
      {
        schemaVersion: 1,
        phases: { scenario: [{ type: 'text', markup: '' }], microDecision: [], revelation: [] },
      },
    ],
    [
      'id repetido',
      {
        schemaVersion: 1,
        phases: {
          scenario: [{ type: 'widget', id: 'x', widget: 'growth-calculator', props: {} }],
          microDecision: [{ type: 'widget', id: 'x', widget: 'growth-calculator', props: {} }],
          revelation: [],
        },
      },
    ],
  ])('rejeita %s', (_name, value) => {
    expect(lessonBlocksSchema.safeParse(value).success).toBe(false)
  })
})

describe('parseLessonBlocks', () => {
  it('ausente ou inválido vira null (player usa o texto legado)', () => {
    expect(parseLessonBlocks(null)).toBeNull()
    expect(parseLessonBlocks(undefined)).toBeNull()
    expect(parseLessonBlocks({ lixo: true })).toBeNull()
  })

  it('devolve o conteúdo validado', () => {
    expect(parseLessonBlocks(CONTRACT_EXAMPLE)?.phases.revelation).toHaveLength(3)
  })
})
