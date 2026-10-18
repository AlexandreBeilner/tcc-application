import { describe, expect, it } from 'vitest'
import { LESSON_SEEDS } from './seedLessons'
import { lessonBlocksSchema } from '../modules/lessons/infrastructure/content/lessonBlocks'
import { WIDGET_MISSION_METRICS } from '../modules/lessons/domain/widgets/widgetGoal'

// Missões das Trilhas 1 a 3 e F (LJ.3.4). A tabela repete o alvo de cada missão; o frontend tem a mesma tabela em
// `LessonWidget/missions.test.tsx`, que confere com a conta real do widget que o ponto de partida não cumpre o alvo
// e que o "Me mostra" cumpre. Mudar um alvo exige mudar os dois testes.
interface Expected {
  lesson: string
  id: string
  widget: string
  metric: string
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'between'
  value?: number
  min?: number
  max?: number
}

const EXPECTED: Expected[] = [
  {
    lesson: '1.3',
    id: 'calculadora-reserva',
    widget: 'emergency-fund-calculator',
    metric: 'monthsToReach',
    op: 'lte',
    value: 12,
  },
  {
    lesson: '1.5',
    id: 'barra-fgc',
    widget: 'fgc-coverage-bar',
    metric: 'uncoveredAmount',
    op: 'lte',
    value: 0,
  },
]

function goalsOf(code: string) {
  const lesson = LESSON_SEEDS.find((l) => l.code === code)
  const blocks = Object.values(lesson?.blocks?.phases ?? {}).flat()
  return blocks.filter((b) => b.type === 'widget') as {
    id: string
    widget: string
    goal?: Record<string, unknown>
  }[]
}

describe('missões das Trilhas 1 a 3 e F no seed (LJ.3.4)', () => {
  it.each(EXPECTED.map((e) => [`${e.lesson}:${e.id}`, e] as const))(
    '%s tem a missão esperada, com métrica declarada pelo widget',
    (_name, e) => {
      const widget = goalsOf(e.lesson).find((w) => w.id === e.id)
      expect(widget?.widget).toBe(e.widget)
      expect(widget?.goal).toMatchObject({ metric: e.metric, op: e.op })
      for (const key of ['value', 'min', 'max'] as const) {
        if (e[key] !== undefined) expect(widget?.goal?.[key]).toBe(e[key])
      }
      expect(WIDGET_MISSION_METRICS[e.widget as keyof typeof WIDGET_MISSION_METRICS]).toContain(
        e.metric,
      )
    },
  )

  it('as lições com missão seguem dentro do contrato de blocos', () => {
    for (const e of EXPECTED) {
      const lesson = LESSON_SEEDS.find((l) => l.code === e.lesson)
      expect(lessonBlocksSchema.safeParse(lesson?.blocks).success, e.lesson).toBe(true)
    }
  })
})
