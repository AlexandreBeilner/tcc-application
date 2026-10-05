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
  'equivalent-rate',
  'ir-regressive-table',
  'product-comparator',
  'compound-growth',
  'real-return',
  'selic-ipca-chart',
  'copom-timeline',
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

export const widgetPropsSchemas = {
  callout: calloutProps,
  'platform-note': platformNoteProps,
  'equivalent-rate': equivalentRateProps,
  'ir-regressive-table': irRegressiveTableProps,
  'product-comparator': productComparatorProps,
  'compound-growth': compoundGrowthProps,
  'real-return': realReturnProps,
  'selic-ipca-chart': selicIpcaChartProps,
  'savings-vs-selic': savingsVsSelicProps,
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
  z.object({
    ...checkBase,
    kind: z.literal('numeric'),
    answer: z.number().finite(),
    tolerance: z.number().finite().min(0),
    unit: z.string().min(1).max(20).optional(),
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

export const blockSchema = z.union([textBlock, widgetBlock, checkBlock])

export const lessonBlocksSchema = z
  .object({
    schemaVersion: z.literal(1),
    phases: z.object({
      scenario: z.array(blockSchema),
      microDecision: z.array(blockSchema),
      revelation: z.array(blockSchema),
    }),
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
