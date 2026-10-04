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
export const WIDGET_IDS = [
  'callout',
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

// Widgets sem configuração por lição hoje (a Calculadora e o comparador da 6.7
// nascem vazios); o objeto vazio fica estrito para o editor da N.23 não
// aceitar props que nenhum widget lê.
const emptyProps = z.object({}).strict()

const liveIndicatorProps = z.object({ ticker: z.string().min(1).max(20) })
const liveMacroProps = z.object({ windowDays: z.number().int().min(7).max(365).optional() })

export const widgetPropsSchemas = {
  callout: calloutProps,
  'growth-calculator': emptyProps,
  'fixed-income-comparison': emptyProps,
  'live-indicator': liveIndicatorProps,
  'live-macro': liveMacroProps,
} as const satisfies Record<WidgetId, z.ZodType>

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

export const blockSchema = z.union([textBlock, widgetBlock])

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
    const ids = Object.values(blocks.phases)
      .flat()
      .flatMap((block) => (block.type === 'widget' ? [block.id] : []))
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['phases'], message: 'id de widget repetido na lição' })
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
