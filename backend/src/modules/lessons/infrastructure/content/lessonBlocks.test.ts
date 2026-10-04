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
    microDecision: [{ type: 'widget', id: 'calc', widget: 'growth-calculator', props: {} }],
    revelation: [
      {
        type: 'widget',
        id: 'ind',
        widget: 'live-indicator',
        props: { ticker: 'VALR3' },
        caption: 'Indicadores de hoje',
      },
      { type: 'widget', id: 'macro', widget: 'live-macro', props: { windowDays: 90 } },
    ],
  },
}

describe('lessonBlocksSchema', () => {
  it('aceita o exemplo do contrato', () => {
    expect(lessonBlocksSchema.safeParse(CONTRACT_EXAMPLE).success).toBe(true)
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
    expect(parseLessonBlocks(CONTRACT_EXAMPLE)?.phases.revelation).toHaveLength(2)
  })
})
