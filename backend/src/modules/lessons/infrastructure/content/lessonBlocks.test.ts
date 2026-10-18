import { describe, expect, it } from 'vitest'
import { lessonBlocksSchema, parseLessonBlocks } from './lessonBlocks'

// Mesmo exemplo do teste de contrato do frontend
// (`features/lessons/widgets/schema/index.test.ts`): se um dos dois lados mudar
// o contrato sem o outro, um deles quebra.
export const CONTRACT_EXAMPLE = {
  schemaVersion: 1,
  summary: [
    'Juros sobre juros fazem o tempo trabalhar a seu favor.',
    'LCI isenta pode vencer o CDB.',
  ],
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
        kind: 'single',
        prompt: 'Taxa bruta equivalente?',
        options: ['9,5%', '12,26%'],
        answer: 1,
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

  it('aceita o resumo "O que ficou" opcional, de 2 a 3 frases de até 120 caracteres', () => {
    const withSummary = (summary: unknown) => ({ ...CONTRACT_EXAMPLE, summary })
    expect(lessonBlocksSchema.safeParse(withSummary(['Uma ideia.', 'Outra ideia.'])).success).toBe(
      true,
    )
    expect(lessonBlocksSchema.safeParse(withSummary(['a', 'b', 'c'])).success).toBe(true)
    expect(lessonBlocksSchema.safeParse(withSummary(['só uma'])).success).toBe(false)
    expect(lessonBlocksSchema.safeParse(withSummary(['a', 'b', 'c', 'd'])).success).toBe(false)
    expect(lessonBlocksSchema.safeParse(withSummary(['a', 'x'.repeat(121)])).success).toBe(false)
    expect(lessonBlocksSchema.safeParse(withSummary(['a', ''])).success).toBe(false)
  })

  describe('"Saiba mais" (LJ.5.7)', () => {
    const more = (blocks: unknown[], id = 'm1') => ({ type: 'more', id, title: 'Detalhe', blocks })
    const withScenario = (...scenario: unknown[]) => ({
      ...CONTRACT_EXAMPLE,
      phases: { ...CONTRACT_EXAMPLE.phases, scenario },
    })
    const text = { type: 'text', markup: 'Antes.' }
    const inner = { type: 'text', markup: 'Detalhe.' }

    it('aceita texto e widget sem missão, depois de outro bloco da fase', () => {
      const widget = {
        type: 'widget',
        id: 'w1',
        widget: 'callout',
        props: { title: 't', body: 'b' },
      }
      expect(lessonBlocksSchema.safeParse(withScenario(text, more([inner, widget]))).success).toBe(
        true,
      )
    })

    it.each([
      ['como primeiro bloco da fase', withScenario(more([inner]), text)],
      ['vazio', withScenario(text, more([]))],
      [
        'com pergunta dentro',
        withScenario(
          text,
          more([
            {
              type: 'check',
              id: 'q',
              kind: 'true_false',
              prompt: 'p',
              answer: true,
              explanation: 'e',
            },
          ]),
        ),
      ],
      ['com outro "Saiba mais" dentro', withScenario(text, more([more([inner], 'm2')]))],
      [
        'com missão num widget',
        withScenario(
          text,
          more([
            {
              type: 'widget',
              id: 'w2',
              widget: 'real-return',
              props: {},
              goal: { text: 't', metric: 'realReturnPct', op: 'lt', value: 0, reveal: 'r' },
            },
          ]),
        ),
      ],
      ['com título longo demais', withScenario(text, { ...more([inner]), title: 'x'.repeat(61) })],
      ['com id repetido', withScenario(text, more([inner]), more([inner]))],
    ])('recusa "Saiba mais" %s', (_name, blocks) => {
      expect(lessonBlocksSchema.safeParse(blocks).success).toBe(false)
    })

    it('recusa id de widget de dentro repetido com outro bloco da lição', () => {
      const dup = {
        type: 'widget',
        id: 'calc',
        widget: 'callout',
        props: { title: 't', body: 'b' },
      }
      expect(lessonBlocksSchema.safeParse(withScenario(text, more([dup]))).success).toBe(false)
    })
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
        {
          type: 'widget',
          id: 'h',
          widget: 'mtm-seesaw',
          props: { indexer: 'ipca-plus', yearsToMaturity: 5 },
        },
        {
          type: 'widget',
          id: 'i',
          widget: 'fgc-coverage-bar',
          props: { institutions: 3, sameConglomerate: true },
        },
        { type: 'widget', id: 'j', widget: 'rating-ruler', props: { highlight: 'BBB' } },
        {
          type: 'widget',
          id: 'k',
          widget: 'bond-price-calculator',
          props: { ratePct: 10, years: 1 },
        },
        {
          type: 'widget',
          id: 'l',
          widget: 'ipca-plus-simulator',
          props: { years: 10, ipcaPct: 4 },
        },
        {
          type: 'widget',
          id: 'm',
          widget: 'breakeven-inflation',
          props: { prefixedPct: 13, realPct: 7 },
        },
        {
          type: 'widget',
          id: 'n',
          widget: 'ownership-calculator',
          props: { yourShares: 50, payoutPct: 40 },
        },
        {
          type: 'widget',
          id: 'o',
          widget: 'bookbuilding-simulator',
          props: { offeredShares: 500000, primaryPct: 100 },
        },
        { type: 'widget', id: 'p', widget: 'ticker-decoder', props: {} },
        { type: 'widget', id: 'q', widget: 'headline-triage', props: {} },
        { type: 'widget', id: 'r', widget: 'order-book', props: {} },
        {
          type: 'widget',
          id: 's',
          widget: 'interactive-balance',
          props: { costsPct: 60, taxPct: 34 },
        },
        { type: 'widget', id: 't', widget: 'margin-comparator', props: {} },
        { type: 'widget', id: 'u', widget: 'roe-lab', props: { netIncome: 30, selicPct: 12 } },
        { type: 'widget', id: 'v', widget: 'multiples-calculator', props: { price: 30 } },
        { type: 'widget', id: 'w', widget: 'debt-thermometer', props: { cdiSharePct: 50 } },
        { type: 'widget', id: 'x1', widget: 'fee-drag', props: { feeBPct: 1.5, years: 30 } },
        {
          type: 'widget',
          id: 'x2',
          widget: 'equity-tax-calculator',
          props: { kind: 'daytrade', assetClass: 'etf', profit: -500 },
        },
        { type: 'widget', id: 'x3', widget: 'tax-decision-tree', props: {} },
        {
          type: 'widget',
          id: 'r1',
          widget: 'risk-return-scatter',
          props: { highlight: 'fii', profile: 'moderate' },
        },
        {
          type: 'widget',
          id: 'r2',
          widget: 'allocation-donut',
          props: { profile: 'aggressive', amount: 5000 },
        },
        { type: 'widget', id: 'r3', widget: 'risk-profile-quiz', props: {} },
        { type: 'widget', id: 'r4', widget: 'behavior-bias-quiz', props: {} },
        { type: 'widget', id: 'x4', widget: 'budget-split', props: { income: 6000, leisure: 500 } },
        {
          type: 'widget',
          id: 'x5',
          widget: 'debt-snowball',
          props: { balance: 8000, payment: 900 },
        },
        {
          type: 'widget',
          id: 'x6',
          widget: 'pay-or-invest',
          props: { debtMonthlyPct: 8, irPct: 17.5 },
        },
        {
          type: 'widget',
          id: 'y1',
          widget: 'dividend-timeline',
          props: { comDay: 2, paymentDay: 15 },
        },
        {
          type: 'widget',
          id: 'y2',
          widget: 'dividend-net-calculator',
          props: { kind: 'jcp', otherSameMonth: 60000 },
        },
        {
          type: 'widget',
          id: 'y3',
          widget: 'etf-shock-simulator',
          props: {
            holdings: [
              { name: 'A', weightPct: 60 },
              { name: 'B', weightPct: 40 },
            ],
          },
        },
        {
          type: 'widget',
          id: 'y4',
          widget: 'fii-monthly-calendar',
          props: { payoutBusinessDay: 7 },
        },
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
    ['interactive-balance', { costsPct: 95 }],
    ['margin-comparator', { a: { netRevenue: 0, grossProfit: 0, ebit: 0, netIncome: 0 } }],
    ['roe-lab', { equity: 0 }],
    ['multiples-calculator', { price: 100 }],
    ['debt-thermometer', { cdiSharePct: 120 }],
    ['fee-drag', { feeBPct: 9 }],
    ['fee-drag', { years: 0 }],
    ['equity-tax-calculator', { kind: 'position' }],
    ['budget-split', { income: 10 }],
    ['risk-return-scatter', { highlight: 'bitcoin' }],
    ['allocation-donut', { amount: 1 }],
    ['debt-snowball', { monthlyRatePct: 40 }],
    ['pay-or-invest', { irPct: 50 }],
    ['budget-split', { housing: -1 }],
    ['equity-tax-calculator', { salesMonth: -1 }],
    ['dividend-timeline', { comDay: 9 }],
    ['dividend-timeline', { paymentDay: 3 }],
    ['dividend-net-calculator', { kind: 'bonus' }],
    ['etf-shock-simulator', { holdings: [{ name: 'A', weightPct: 60 }] }],
    [
      'etf-shock-simulator',
      {
        holdings: [
          { name: 'A', weightPct: 60 },
          { name: 'B', weightPct: 50 },
        ],
      },
    ],
    ['fii-monthly-calendar', { payoutBusinessDay: 25 }],
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
  ])('rejeita check inválido: %s', (_name, check) => {
    const blocks = {
      schemaVersion: 1,
      phases: { scenario: [check], microDecision: [], revelation: [] },
    }
    expect(lessonBlocksSchema.safeParse(blocks).success).toBe(false)
  })

  describe('estimativa (LJ.2.1)', () => {
    const estimate = {
      type: 'check',
      id: 'e1',
      kind: 'estimate',
      prompt: 'Quanto viram?',
      min: 1000,
      max: 10000,
      step: 100,
      unit: 'brl',
      answer: 6727.5,
      tolerancePct: 10,
      explanation: 'Juros sobre juros.',
    }
    const withCheck = (check: unknown) => ({
      schemaVersion: 1,
      phases: { scenario: [check], microDecision: [], revelation: [] },
    })

    it('aceita a estimativa completa', () => {
      expect(lessonBlocksSchema.safeParse(withCheck(estimate)).success).toBe(true)
    })

    it.each([
      ['min >= max', { min: 5000, max: 5000 }],
      ['valor real fora da régua', { answer: 20000 }],
      ['passo zero', { step: 0 }],
      ['tolerância zero', { tolerancePct: 0 }],
      ['tolerância acima de 100', { tolerancePct: 101 }],
      ['unidade desconhecida', { unit: 'usd' }],
    ])('rejeita estimativa inválida: %s', (_name, patch) => {
      expect(lessonBlocksSchema.safeParse(withCheck({ ...estimate, ...patch })).success).toBe(false)
    })
  })

  describe('ordenar (LJ.2.3)', () => {
    const order = {
      type: 'check',
      id: 'o1',
      kind: 'order',
      prompt: 'Do menos ao mais arriscado',
      items: ['Tesouro Selic', 'CDB', 'FII', 'Ação pequena'],
      answer: [0, 1, 2, 3],
      lowLabel: 'Menos risco',
      highLabel: 'Mais risco',
      explanation: 'Quanto mais incerto o retorno, maior o risco.',
    }
    const withCheck = (check: unknown) => ({
      schemaVersion: 1,
      phases: { scenario: [check], microDecision: [], revelation: [] },
    })

    it('aceita ordenar completo e sem rótulos de ponta', () => {
      expect(lessonBlocksSchema.safeParse(withCheck(order)).success).toBe(true)
      expect(
        lessonBlocksSchema.safeParse(
          withCheck({ ...order, lowLabel: undefined, highLabel: undefined }),
        ).success,
      ).toBe(true)
    })

    it.each([
      ['2 itens', { items: ['a', 'b'], answer: [0, 1] }],
      ['7 itens', { items: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], answer: [0, 1, 2, 3, 4, 5, 6] }],
      ['gabarito de outro tamanho', { answer: [0, 1, 2] }],
      ['gabarito com repetição', { answer: [0, 1, 1, 3] }],
      ['gabarito fora dos itens', { answer: [0, 1, 2, 4] }],
      ['item vazio', { items: ['a', '', 'c', 'd'] }],
    ])('rejeita ordenar inválido: %s', (_name, patch) => {
      expect(lessonBlocksSchema.safeParse(withCheck({ ...order, ...patch })).success).toBe(false)
    })
  })

  describe('agrupar (LJ.2.4)', () => {
    const categorize = {
      type: 'check',
      id: 'g1',
      kind: 'categorize',
      prompt: 'Renda fixa ou variável?',
      groups: ['Renda fixa', 'Renda variável'],
      items: ['Tesouro Selic', 'Ação', 'CDB', 'FII'],
      answer: [0, 1, 0, 1],
      explanation: 'Porque sim.',
    }
    const withCheck = (check: unknown) => ({
      schemaVersion: 1,
      phases: { scenario: [check], microDecision: [], revelation: [] },
    })

    it('aceita agrupar completo e com três grupos', () => {
      expect(lessonBlocksSchema.safeParse(withCheck(categorize)).success).toBe(true)
      expect(
        lessonBlocksSchema.safeParse(
          withCheck({ ...categorize, groups: ['a', 'b', 'c'], answer: [0, 1, 2, 0] }),
        ).success,
      ).toBe(true)
    })

    it.each([
      ['1 grupo', { groups: ['a'], answer: [0, 0, 0, 0] }],
      ['4 grupos', { groups: ['a', 'b', 'c', 'd'], answer: [0, 1, 2, 3] }],
      ['2 itens', { items: ['a', 'b'], answer: [0, 1] }],
      ['gabarito de outro tamanho', { answer: [0, 1, 0] }],
      ['grupo inexistente no gabarito', { answer: [0, 1, 0, 2] }],
      ['grupo sem nenhum item', { answer: [0, 0, 0, 0] }],
    ])('rejeita agrupar inválido: %s', (_name, patch) => {
      expect(lessonBlocksSchema.safeParse(withCheck({ ...categorize, ...patch })).success).toBe(
        false,
      )
    })
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

describe('formula-walkthrough', () => {
  const doc = (items: unknown[]) => ({
    schemaVersion: 1,
    phases: {
      scenario: [{ type: 'text', markup: 'a' }],
      microDecision: [{ type: 'text', markup: 'a' }],
      revelation: [{ type: 'widget', id: 'f', widget: 'formula-walkthrough', props: { items } }],
    },
  })
  const item = { label: 'Simples', formula: 'M = C', numbers: 'M = 1.000', result: 'R$ 1.000' }

  it('aceita itens completos', () => {
    expect(lessonBlocksSchema.safeParse(doc([item])).success).toBe(true)
  })

  it('rejeita lista vazia e item sem resultado', () => {
    expect(lessonBlocksSchema.safeParse(doc([])).success).toBe(false)
    expect(lessonBlocksSchema.safeParse(doc([{ ...item, result: '' }])).success).toBe(false)
  })
})

describe('missão de widget (LJ.3.1)', () => {
  const goal = {
    text: 'Deixe o rendimento real negativo',
    metric: 'realReturnPct',
    op: 'lt',
    value: 0,
    reveal: 'Rendeu no papel e perdeu no mercado.',
    showMe: { nominalPct: 4, inflationPct: 8 },
  }
  const blocks = (override: object = {}, widget = 'real-return', props: object = {}) => ({
    schemaVersion: 1,
    phases: {
      scenario: [{ type: 'widget', id: 'w', widget, props, goal: { ...goal, ...override } }],
      microDecision: [],
      revelation: [],
    },
  })

  it('aceita missão com métrica que o widget declara', () => {
    expect(lessonBlocksSchema.safeParse(blocks()).success).toBe(true)
    expect(
      lessonBlocksSchema.safeParse(
        blocks(
          { metric: 'interestRatio', op: 'gte', value: 2, showMe: { periodYears: 15 } },
          'growth-calculator',
          { initialCapital: 1000 },
        ),
      ).success,
    ).toBe(true)
  })

  it.each([
    ['métrica que o widget não declara', { metric: 'outra' }],
    ['op sem value', { value: undefined }],
    ['between sem limites', { op: 'between', value: undefined }],
    ['between invertido', { op: 'between', min: 2, max: 1 }],
    ['showMe que quebra as props do widget', { showMe: { nominalPct: 999 } }],
    ['texto da missão vazio', { text: '' }],
  ])('rejeita %s', (_name, override) => {
    expect(lessonBlocksSchema.safeParse(blocks(override)).success).toBe(false)
  })

  it('rejeita missão em widget sem métricas declaradas', () => {
    expect(
      lessonBlocksSchema.safeParse(blocks({}, 'callout', { title: 't', body: 'b' })).success,
    ).toBe(false)
  })
})
