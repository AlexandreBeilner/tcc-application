import { z } from 'zod'
import type { LessonBlocks, WidgetId } from '../../domain/widgets/lessonBlocks'

// Validação do contrato `blocks` (RC.3.1; tipos em `domain/widgets`). Cada fase
// (Cenário, Micro-decisão, Revelação) vira uma lista de blocos tipados em vez
// de uma string só. `lessons.blocks` nulo (ou inválido) faz o player cair no texto
// legado (`scenarioText`/`microDecisionPrompt`/`revelationText`), então a
// coluna é puramente aditiva.
//
// Uma cópia espelhada deste schema vive em
// `frontend/src/features/lessons/widgets/schema/` (o frontend valida de novo
// ao renderizar); os dois testes de contrato usam o mesmo exemplo.
//
// Regras do contrato de widget: props só de configuração (valores iniciais,
// limites, presets, rótulos); saída só visual; sem estado no servidor.
// Perguntas intermediárias por lição (RC.3.2: 3 a 7 suportadas; o piso é de autoria).
export const MAX_CHECKPOINTS_PER_LESSON = 7

export const WIDGET_IDS = [
  'callout',
  'platform-note',
  'formula-walkthrough',
  'equivalent-rate',
  'ir-regressive-table',
  'product-comparator',
  'compound-growth',
  'real-return',
  'selic-ipca-chart',
  'copom-timeline',
  'inflation-selic-seesaw',
  'emergency-fund-calculator',
  'where-to-keep',
  'mtm-seesaw',
  'fgc-coverage-bar',
  'rating-ruler',
  'bond-price-calculator',
  'ipca-plus-simulator',
  'breakeven-inflation',
  'ownership-calculator',
  'bookbuilding-simulator',
  'ticker-decoder',
  'headline-triage',
  'order-book',
  'interactive-balance',
  'margin-comparator',
  'roe-lab',
  'multiples-calculator',
  'debt-thermometer',
  'dividend-timeline',
  'dividend-net-calculator',
  'etf-shock-simulator',
  'fii-monthly-calendar',
  'fee-drag',
  'risk-return-scatter',
  'allocation-donut',
  'risk-profile-quiz',
  'behavior-bias-quiz',
  'budget-split',
  'debt-snowball',
  'pay-or-invest',
  'equity-tax-calculator',
  'tax-decision-tree',
  'savings-vs-selic',
  'growth-calculator',
  'fixed-income-comparison',
  'live-indicator',
  'live-macro',
] as const satisfies readonly WidgetId[]

const calloutProps = z.object({
  tone: z.enum(['info', 'tip', 'warning']).default('info'),
  title: z.string().min(1),
  body: z.string().min(1),
  formula: z.string().min(1).optional(),
})

// Fórmula passo a passo: a fórmula com letras, a mesma conta com os números e o
// resultado, no mesmo cartão, para a pessoa nunca ver só a fórmula solta.
const formulaWalkthroughProps = z.object({
  intro: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        formula: z.string().min(1),
        legend: z.string().min(1).optional(),
        numbers: z.string().min(1),
        result: z.string().min(1),
      }),
    )
    .min(1)
    .max(3),
  note: z.string().min(1).optional(),
})

// Bloco "Na plataforma" (RC.3.3): onde a plataforma difere do Brasil real, a
// diferença vai aqui, sempre com as três linhas, nunca misturada ao texto
// principal (diretrizes-redacao-licoes.md §3).
const platformNoteProps = z.object({
  brazil: z.string().min(1),
  here: z.string().min(1),
  why: z.string().min(1),
})

// Widgets de cálculo de renda fixa (RC.3.4a): as props só configuram o ponto de
// partida (taxas, prazos, valor); a conta e a tabela de IR vivem no frontend.
const equivalentRateProps = z.object({
  exemptRatePct: z.number().positive().max(100).default(9.5),
  cdbRatePct: z.number().positive().max(100).default(12),
  daysPresets: z.array(z.number().int().min(1).max(3650)).min(1).max(4).default([60, 720]),
})

const irRegressiveTableProps = z.object({
  grossYield: z.number().positive().default(1000),
  initialDays: z.number().int().min(1).max(1000).default(90),
})

const productComparatorProps = z.object({
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        annualRatePct: z.number().positive().max(100),
        taxExempt: z.boolean(),
        liquidity: z.string().min(1).optional(),
        fgc: z.string().min(1).optional(),
      }),
    )
    .min(2)
    .max(3),
  amount: z.number().positive().default(10000),
  days: z.number().int().min(1).max(3650).default(180),
})

// Widgets de juros e inflação (RC.3.4c): props só configuram o ponto de partida.
// `compound-growth` aceita o limite do slider (480 meses = 40 anos); a Selic e o
// IPCA do gráfico vêm do motor, o widget só escolhe a janela.
const compoundGrowthProps = z.object({
  initial: z.number().min(0).max(10_000_000).default(1000),
  monthly: z.number().min(0).max(1_000_000).default(0),
  ratePct: z.number().min(0).max(100).default(10),
  rateUnit: z.enum(['year', 'month']).default('year'),
  months: z.number().int().min(1).max(480).default(60),
  showSimple: z.boolean().default(true),
})

const realReturnProps = z.object({
  nominalPct: z.number().min(0).max(20).default(10),
  inflationPct: z.number().min(0).max(20).default(5),
  amount: z.number().positive().default(10000),
})

const selicIpcaChartProps = z.object({ windowDays: z.number().int().min(7).max(365).default(365) })

// Gangorra inflação x Selic (RC.5.4): a leitura de pressão vive no frontend; a
// prop só escolhe o ponto de partida do controle.
const inflationSelicSeesawProps = z.object({ inflationPct: z.number().min(0).max(15).default(6) })

// Calculadora de reserva de emergência (RC.4.6): a conta vive no frontend; as
// props só escolhem o ponto de partida dos campos.
const emergencyFundCalculatorProps = z.object({
  monthlyCost: z.number().min(0).max(1_000_000).default(3000),
  incomeType: z.enum(['stable', 'variable']).default('stable'),
  monthlyContribution: z.number().min(0).max(1_000_000).default(500),
})

// Gangorra da marcação a mercado (RC.3.4b): a conta vive no frontend; as props
// só escolhem o ponto de partida e o tipo de título.
const mtmSeesawProps = z.object({
  contractRatePct: z.number().min(2).max(25).default(11.75),
  yearsToMaturity: z.number().min(0.25).max(10).default(2),
  indexer: z.enum(['prefixed', 'ipca-plus', 'selic']).default('prefixed'),
})

// Barra de cobertura do FGC (RC.3.4b): valor por instituição, quantas
// instituições quebram e se são do mesmo conglomerado. Os limites (R$ 250 mil e
// R$ 1 milhão) são os fatos fgc-* e ficam no frontend.
const fgcCoverageBarProps = z.object({
  amountPerInstitution: z.number().min(0).max(5_000_000).default(400_000),
  institutions: z.number().int().min(1).max(6).default(1),
  sameConglomerate: z.boolean().default(false),
})

// Régua de rating (RC.3.4b): a escala é convenção das agências; a prop só
// escolhe a nota que começa selecionada.
const ratingRulerProps = z.object({
  highlight: z.enum(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D']).default('AA'),
})

// Títulos públicos (RC.3.4d): as contas vivem no frontend; as props só escolhem
// o ponto de partida dentro dos limites dos controles.
const bondPriceCalculatorProps = z.object({
  ratePct: z.number().min(6).max(18).default(11.75),
  years: z.number().min(0.25).max(10).default(2),
  amount: z.number().min(30).max(10_000_000).default(10_000),
})

const ipcaPlusSimulatorProps = z.object({
  amount: z.number().positive().max(10_000_000).default(10_000),
  realRatePct: z.number().min(3).max(9).default(6),
  years: z.number().int().min(1).max(20).default(5),
  ipcaPct: z.number().min(0).max(12).default(5),
})

const breakevenInflationProps = z.object({
  prefixedPct: z.number().min(6).max(18).default(12.5),
  realPct: z.number().min(3).max(10).default(7.5),
  expectedInflationPct: z.number().min(0).max(12).default(5),
})

// Ações, abertura da Trilha 2 (RC.3.4e): as contas e o conteúdo (tickers,
// manchetes, ordens de exemplo do bookbuilding, livro de ofertas) vivem no
// frontend; as props só escolhem o ponto de partida.
const ownershipCalculatorProps = z.object({
  price: z.number().positive().max(100_000).default(20),
  totalShares: z.number().int().positive().max(100_000_000_000).default(1_000_000),
  yourShares: z.number().int().min(0).max(100_000_000_000).default(100),
  profit: z.number().min(0).max(100_000_000_000).default(5_000_000),
  payoutPct: z.number().min(0).max(100).default(30),
})

const bookbuildingSimulatorProps = z.object({
  offeredShares: z.number().int().min(250_000).max(2_000_000).default(1_000_000),
  primaryPct: z.number().min(0).max(100).default(60),
  existingShares: z.number().int().positive().max(100_000_000_000).default(4_000_000),
})

// Poupança contra Tesouro Selic (RC.5.2): a conta vive no frontend; as props só
// escolhem o ponto de partida dentro dos limites dos controles.
const savingsVsSelicProps = z.object({
  selicPct: z.number().min(2).max(16).default(14),
  trMonthlyPct: z.number().min(0).max(0.3).default(0.15),
  amount: z.number().positive().default(10000),
  months: z.number().int().min(1).max(36).default(12),
})

// Widgets sem configuração por lição hoje (a Calculadora e o comparador da 6.7
// nascem vazios); o objeto vazio fica estrito para o editor da N.23 não
// aceitar props que nenhum widget lê.
const emptyProps = z.object({}).strict()

const liveIndicatorProps = z.object({ ticker: z.string().min(1).max(20) })
const liveMacroProps = z.object({ windowDays: z.number().int().min(7).max(365).optional() })

const companyMarginsProps = z.object({
  netRevenue: z.number().positive().max(100_000),
  grossProfit: z.number().min(-100_000).max(100_000),
  ebit: z.number().min(-100_000).max(100_000),
  netIncome: z.number().min(-100_000).max(100_000),
})

export const widgetPropsSchemas = {
  callout: calloutProps,
  'platform-note': platformNoteProps,
  'formula-walkthrough': formulaWalkthroughProps,
  'equivalent-rate': equivalentRateProps,
  'ir-regressive-table': irRegressiveTableProps,
  'product-comparator': productComparatorProps,
  'compound-growth': compoundGrowthProps,
  'real-return': realReturnProps,
  'selic-ipca-chart': selicIpcaChartProps,
  'savings-vs-selic': savingsVsSelicProps,
  'inflation-selic-seesaw': inflationSelicSeesawProps,
  'emergency-fund-calculator': emergencyFundCalculatorProps,
  'where-to-keep': emptyProps,
  'mtm-seesaw': mtmSeesawProps,
  'fgc-coverage-bar': fgcCoverageBarProps,
  'rating-ruler': ratingRulerProps,
  'bond-price-calculator': bondPriceCalculatorProps,
  'ipca-plus-simulator': ipcaPlusSimulatorProps,
  'breakeven-inflation': breakevenInflationProps,
  'ownership-calculator': ownershipCalculatorProps,
  'bookbuilding-simulator': bookbuildingSimulatorProps,
  'ticker-decoder': emptyProps,
  'headline-triage': emptyProps,
  'order-book': emptyProps,
  'interactive-balance': z.object({
    netRevenue: z.number().positive().max(100_000).default(1000),
    costsPct: z.number().min(0).max(90).default(55),
    expensesPct: z.number().min(0).max(50).default(15),
    financialResult: z.number().min(-300).max(0).default(-100),
    taxPct: z.number().min(0).max(40).default(30),
    cash: z.number().min(0).max(1000).default(200),
    fixedAssets: z.number().min(0).max(2000).default(800),
    debt: z.number().min(0).max(2000).default(600),
    otherLiabilities: z.number().min(0).max(1000).default(150),
  }),
  'margin-comparator': z.object({
    a: companyMarginsProps.default({
      netRevenue: 1000,
      grossProfit: 400,
      ebit: 200,
      netIncome: 50,
    }),
    b: companyMarginsProps.default({ netRevenue: 200, grossProfit: 90, ebit: 60, netIncome: 40 }),
  }),
  'roe-lab': z.object({
    revenue: z.number().positive().max(100_000).default(1000),
    netIncome: z.number().min(-100_000).max(100_000).default(100),
    assets: z.number().positive().max(100_000).default(1000),
    equity: z.number().positive().max(100_000).default(500),
    selicPct: z.number().min(2).max(16).default(10.5),
  }),
  'multiples-calculator': z.object({
    price: z.number().min(5).max(60).default(24),
    netIncome: z.number().min(-100_000).max(100_000).default(120),
    equity: z.number().min(-100_000).max(100_000).default(300),
    shares: z.number().positive().max(100_000).default(60),
    selicPct: z.number().min(2).max(16).default(10.5),
  }),
  'debt-thermometer': z.object({
    grossDebt: z.number().min(0).max(2000).default(800),
    cash: z.number().min(0).max(1500).default(300),
    ebit: z.number().min(-100_000).max(100_000).default(250),
    financialExpense: z.number().min(0).max(100_000).default(50),
    cdiSharePct: z.number().min(0).max(100).default(100),
  }),
  'dividend-timeline': z.object({
    quantity: z.number().int().min(1).max(1_000_000).default(100),
    valuePerShare: z.number().min(0.01).max(1000).default(1),
    comDay: z.number().int().min(1).max(5).default(3),
    paymentDay: z.number().int().min(8).max(30).default(12),
  }),
  'dividend-net-calculator': z.object({
    quantity: z.number().int().min(1).max(1_000_000).default(1000),
    valuePerShare: z.number().min(0.01).max(1000).default(1),
    kind: z.enum(['dividend', 'jcp']).default('dividend'),
    otherSameMonth: z.number().min(0).max(200_000).default(0),
  }),
  'etf-shock-simulator': z
    .object({
      holdings: z
        .array(z.object({ name: z.string().min(1).max(30), weightPct: z.number().min(1).max(100) }))
        .min(2)
        .max(6)
        .default([
          { name: 'Empresa A', weightPct: 40 },
          { name: 'Empresa B', weightPct: 20 },
          { name: 'Empresa C', weightPct: 25 },
          { name: 'Empresa D', weightPct: 15 },
        ]),
      navBefore: z.number().min(10).max(1000).default(100),
    })
    .refine(
      (props) => Math.abs(props.holdings.reduce((sum, h) => sum + h.weightPct, 0) - 100) < 0.01,
      {
        message: 'Os pesos da cesta precisam somar 100%',
      },
    ),
  'fii-monthly-calendar': z.object({
    monthlyPerShare: z.number().min(0.01).max(50).default(1.1),
    shares: z.number().int().min(1).max(1_000_000).default(100),
    price: z.number().min(1).max(1000).default(100),
    payoutBusinessDay: z.number().int().min(5).max(15).default(10),
  }),
  'fee-drag': z.object({
    initial: z.number().min(0).max(1_000_000).default(10000),
    monthly: z.number().min(0).max(100_000).default(0),
    grossReturnPct: z.number().min(2).max(16).default(10),
    feeAPct: z.number().min(0).max(4).default(0),
    feeBPct: z.number().min(0).max(4).default(2),
    years: z.number().int().min(1).max(40).default(20),
  }),
  'risk-return-scatter': z.object({
    highlight: z
      .enum(['savings', 'selic-bond', 'cdb', 'ipca-bond', 'fii', 'stocks'])
      .default('stocks'),
    profile: z.enum(['none', 'conservative', 'moderate', 'aggressive']).default('none'),
  }),
  'allocation-donut': z.object({
    profile: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
    amount: z.number().min(100).max(1_000_000).default(10000),
  }),
  'risk-profile-quiz': emptyProps,
  'behavior-bias-quiz': emptyProps,
  'budget-split': z.object({
    income: z.number().min(1000).max(20_000).default(4000),
    housing: z.number().min(0).max(10_000).default(1500),
    food: z.number().min(0).max(10_000).default(800),
    transport: z.number().min(0).max(10_000).default(400),
    leisure: z.number().min(0).max(10_000).default(300),
    debts: z.number().min(0).max(10_000).default(200),
    other: z.number().min(0).max(10_000).default(200),
  }),
  'debt-snowball': z.object({
    balance: z.number().min(500).max(50_000).default(5000),
    monthlyRatePct: z.number().min(0.5).max(16).default(5),
    payment: z.number().min(50).max(5000).default(600),
  }),
  'pay-or-invest': z.object({
    amount: z.number().min(100).max(100_000).default(1000),
    debtMonthlyPct: z.number().min(0.5).max(16).default(5),
    investAnnualPct: z.number().min(4).max(20).default(14),
    irPct: z.number().min(0).max(22.5).default(15),
  }),
  'equity-tax-calculator': z.object({
    kind: z.enum(['swing', 'daytrade']).default('swing'),
    assetClass: z.enum(['stock', 'etf', 'fii']).default('stock'),
    salesMonth: z.number().min(0).max(100_000).default(15000),
    profit: z.number().min(-10_000).max(20_000).default(2000),
    lossCarry: z.number().min(0).max(10_000).default(0),
  }),
  'tax-decision-tree': emptyProps,
  'copom-timeline': emptyProps,
  'growth-calculator': emptyProps,
  'fixed-income-comparison': emptyProps,
  'live-indicator': liveIndicatorProps,
  'live-macro': liveMacroProps,
} as const satisfies Record<WidgetId, z.ZodType>

const checkBase = {
  type: z.literal('check'),
  id: z.string().min(1).max(64),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
}

// Pergunta intermediária (RC.3.2): gabarito e explicação ficam só no servidor.
const checkBlock = z.discriminatedUnion('kind', [
  z
    .object({
      ...checkBase,
      kind: z.literal('single'),
      options: z.array(z.string().min(1)).min(2).max(4),
      answer: z.number().int().min(0),
    })
    .refine((b) => b.answer < b.options.length, {
      path: ['answer'],
      message: 'answer fora das options',
    }),
  z.object({ ...checkBase, kind: z.literal('true_false'), answer: z.boolean() }),
  // Estimativa (LJ.2.2): a régua (`min`, `max`, `step`) vai ao cliente; `answer` e
  // `tolerancePct` ficam no servidor.
  z
    .object({
      ...checkBase,
      kind: z.literal('estimate'),
      min: z.number().finite(),
      max: z.number().finite(),
      step: z.number().positive().finite(),
      unit: z.enum(['brl', 'pct', 'years', 'none']),
      answer: z.number().finite(),
      tolerancePct: z.number().positive().max(100),
    })
    .refine((b) => b.min < b.max, { path: ['max'], message: 'max precisa ser maior que min' })
    .refine((b) => b.answer >= b.min && b.answer <= b.max, {
      path: ['answer'],
      message: 'answer fora da régua',
    }),
])

const textBlock = z.object({ type: z.literal('text'), markup: z.string().min(1) })

const widgetBlock = z
  .object({
    type: z.literal('widget'),
    id: z.string().min(1),
    widget: z.enum(WIDGET_IDS),
    props: z.unknown().default({}),
    caption: z.string().min(1).optional(),
  })
  .superRefine((block, ctx) => {
    const result = widgetPropsSchemas[block.widget].safeParse(block.props)
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['props'],
        message: `props inválidas para o widget ${block.widget}`,
      })
    }
  })

// "O que ficou" (LJ.1.5): de 2 a 3 frases curtas, cada uma que a pessoa diria a um amigo.
export const SUMMARY_MAX_CHARS = 120

export const blockSchema = z.union([textBlock, widgetBlock, checkBlock])

export const lessonBlocksSchema = z
  .object({
    schemaVersion: z.literal(1),
    phases: z.object({
      scenario: z.array(blockSchema),
      microDecision: z.array(blockSchema),
      revelation: z.array(blockSchema),
    }),
    summary: z.array(z.string().min(1).max(SUMMARY_MAX_CHARS)).min(2).max(3).optional(),
  })
  .superRefine((blocks, ctx) => {
    const all = Object.values(blocks.phases).flat()
    const ids = all.flatMap((block) => (block.type === 'text' ? [] : [block.id]))
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['phases'],
        message: 'id de widget ou checkpoint repetido na lição',
      })
    }
    if (all.filter((block) => block.type === 'check').length > MAX_CHECKPOINTS_PER_LESSON) {
      ctx.addIssue({
        code: 'custom',
        path: ['phases'],
        message: `no máximo ${MAX_CHECKPOINTS_PER_LESSON} checkpoints por lição`,
      })
    }
  })

// Garante que o schema e o tipo do domínio não se afastem.
const _contractCheck = (value: z.infer<typeof lessonBlocksSchema>): LessonBlocks => value
void _contractCheck

// Leitura tolerante: valor ausente ou fora do contrato vira `null` e o player
// usa o texto legado. Quem quer o motivo (seed, editor) usa `lessonBlocksSchema`.
export function parseLessonBlocks(raw: unknown): LessonBlocks | null {
  if (raw === null || raw === undefined) {
    return null
  }
  const result = lessonBlocksSchema.safeParse(raw)
  return result.success ? result.data : null
}
