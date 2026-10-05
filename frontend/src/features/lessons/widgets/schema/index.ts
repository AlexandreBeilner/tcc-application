import { z } from 'zod'

// Espelho do contrato `blocks` do backend
// (`backend/src/modules/lessons/infrastructure/content/lessonBlocks.ts`, RC.3.1).
// O backend valida no seed e na leitura; o frontend valida de novo ao
// renderizar (um `blocks` inválido ou widget desconhecido nunca derruba a
// lição). Os dois testes de contrato usam o mesmo exemplo.
export const WIDGET_IDS = [
    'callout',
    'platform-note',
    'equivalent-rate',
    'ir-regressive-table',
    'product-comparator',
    'growth-calculator',
    'fixed-income-comparison',
    'live-indicator',
    'live-macro',
] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

const emptyProps = z.object({}).strict()

export const widgetPropsSchemas = {
    callout: z.object({
        tone: z.enum(['info', 'tip', 'warning']).default('info'),
        title: z.string().min(1),
        body: z.string().min(1),
        formula: z.string().min(1).optional(),
    }),
    'platform-note': z.object({
        brazil: z.string().min(1),
        here: z.string().min(1),
        why: z.string().min(1),
    }),
    'equivalent-rate': z.object({
        exemptRatePct: z.number().positive().max(100).default(9.5),
        cdbRatePct: z.number().positive().max(100).default(12),
        daysPresets: z.array(z.number().int().min(1).max(3650)).min(1).max(4).default([60, 720]),
    }),
    'ir-regressive-table': z.object({
        grossYield: z.number().positive().default(1000),
        initialDays: z.number().int().min(1).max(1000).default(90),
    }),
    'product-comparator': z.object({
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
    }),
    'growth-calculator': emptyProps,
    'fixed-income-comparison': emptyProps,
    'live-indicator': z.object({ ticker: z.string().min(1).max(20) }),
    'live-macro': z.object({ windowDays: z.number().int().min(7).max(365).optional() }),
} as const satisfies Record<WidgetId, z.ZodType>

export type WidgetProps<Id extends WidgetId> = z.output<(typeof widgetPropsSchemas)[Id]>

const textBlock = z.object({ type: z.literal('text'), markup: z.string().min(1) })

// As props ficam `unknown` aqui e são validadas por widget na hora de
// renderizar (`LessonWidget`), para um widget com props ruins virar fallback
// só dele, e não invalidar a lição inteira.
const widgetBlock = z.object({
    type: z.literal('widget'),
    id: z.string().min(1),
    widget: z.string().min(1),
    props: z.unknown().default({}),
    caption: z.string().min(1).optional(),
})

// Pergunta intermediária (RC.3.2), como o servidor a entrega: sem gabarito nem
// explicação (`answer`/`tolerance`/`explanation` ficam só no servidor).
const checkBlock = z.object({
    type: z.literal('check'),
    id: z.string().min(1),
    kind: z.enum(['single', 'true_false', 'numeric']),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(4).optional(),
    unit: z.string().min(1).optional(),
})

const lessonBlocksSchema = z.object({
    schemaVersion: z.literal(1),
    phases: z.object({
        scenario: z.array(z.union([textBlock, widgetBlock, checkBlock])),
        microDecision: z.array(z.union([textBlock, widgetBlock, checkBlock])),
        revelation: z.array(z.union([textBlock, widgetBlock, checkBlock])),
    }),
})

export type LessonBlocks = z.infer<typeof lessonBlocksSchema>
export type LessonBlock = LessonBlocks['phases']['scenario'][number]
export type WidgetBlock = Extract<LessonBlock, { type: 'widget' }>
export type CheckBlock = Extract<LessonBlock, { type: 'check' }>

// Ausente ou fora do contrato vira `null` (o player usa o texto legado).
export function parseLessonBlocks(raw: unknown): LessonBlocks | null {
    if (raw === null || raw === undefined) {
        return null
    }
    const result = lessonBlocksSchema.safeParse(raw)
    return result.success ? result.data : null
}
