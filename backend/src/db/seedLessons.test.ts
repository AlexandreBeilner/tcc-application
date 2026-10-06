import { describe, expect, it } from 'vitest'
import { LESSON_SEEDS, upsertLessonSeed, type LessonSeed } from './seedLessons'
import { lessonBlocksSchema } from '../modules/lessons/infrastructure/content/lessonBlocks'
import { lessons } from './schema'
import type { Database } from './client'

// Fake mínimo do subconjunto de `Database` que `upsertLessonSeed` usa
// (`insert(lessons).values(v).onConflictDoUpdate({ target, set }).returning()`),
// reimplementando a semântica de `ON CONFLICT (<target>) DO UPDATE` do
// Postgres o suficiente pra provar o cenário do achado 010: casar por
// `stableKey` (não `code`) atualiza a linha física existente em vez de criar
// uma nova, preservando `id`.
function createFakeLessonsDb() {
  const rows: Array<Record<string, unknown>> = []

  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoUpdate: ({
          target,
          set,
        }: {
          target: unknown
          set: Record<string, unknown>
        }) => ({
          returning: async () => {
            if (target !== lessons.stableKey) {
              throw new Error('fake só reproduz onConflictDoUpdate com target: lessons.stableKey')
            }
            const existing = rows.find((row) => row.stableKey === value.stableKey)
            if (existing) {
              Object.assign(existing, set)
              return [existing]
            }
            const inserted = { ...value }
            rows.push(inserted)
            return [inserted]
          },
        }),
      }),
    }),
  }

  return { db: db as unknown as Database, rows }
}

function buildSeed(overrides: Partial<LessonSeed> = {}): LessonSeed {
  return {
    stableKey: '1.3',
    code: '1.3',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 8,
    title: 'CDB e o CDI',
    centralConcept: 'CDB como empréstimo ao banco, remunerado por percentual do CDI',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText: '',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
    ...overrides,
  }
}

describe('upsertLessonSeed', () => {
  it('primeira execução insere uma linha nova', async () => {
    const { db, rows } = createFakeLessonsDb()

    await upsertLessonSeed(db, buildSeed())

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ stableKey: '1.3', code: '1.3' })
  })

  it('achado 010: renumerar `code` mantendo o mesmo `stableKey` atualiza a linha existente, não cria uma nova, e preserva `id`', async () => {
    const { db, rows } = createFakeLessonsDb()

    await upsertLessonSeed(db, buildSeed({ stableKey: '1.3', code: '1.3', title: 'CDB e o CDI' }))
    const originalId = rows[0].id

    // Simula a renumeração da M.5: o `code` avança um degrau, mas o
    // `stableKey` (imutável) continua o mesmo — é a mesma lição de sempre.
    await upsertLessonSeed(
      db,
      buildSeed({ stableKey: '1.3', code: '1.4', title: 'CDB e o CDI (renumerada)' }),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(originalId)
    expect(rows[0].code).toBe('1.4')
    expect(rows[0].title).toBe('CDB e o CDI (renumerada)')
  })

  it('duas lições com `stableKey` diferentes nunca colidem, mesmo que uma passe a ocupar o `code` que a outra vacou', async () => {
    const { db, rows } = createFakeLessonsDb()

    await upsertLessonSeed(db, buildSeed({ stableKey: '1.3', code: '1.3' }))
    // Renumeração (mesmo efeito da M.5): a lição acima vaca o `code` '1.3'
    // ao avançar pro seu novo degrau.
    await upsertLessonSeed(db, buildSeed({ stableKey: '1.3', code: '1.4' }))
    // Lição nova: nasce ocupando o `code` que acabou de ser vacado, mas é
    // conteúdo diferente (`stableKey` próprio) — vira linha própria, não
    // sobrescreve a outra.
    await upsertLessonSeed(
      db,
      buildSeed({ stableKey: 'selic-formacao', code: '1.3', title: 'Como a Selic é formada' }),
    )

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.code).sort()).toEqual(['1.3', '1.4'])
  })
})

describe('blocks no seed (RC.3.1)', () => {
  it('toda lição do seed com blocks respeita o contrato', () => {
    for (const seed of LESSON_SEEDS) {
      if (seed.blocks) {
        const result = lessonBlocksSchema.safeParse(seed.blocks)
        expect(result.success, `blocks inválido na lição ${seed.code}`).toBe(true)
      }
    }
  })

  // RC.3.4: nenhum texto manda calcular fora; quem pede conta precisa ter um
  // widget na mesma fase. Pergunta numérica (check) conta como pedido de conta
  // e também exige widget na fase quando o texto diz "calcule".
  it('fase com blocks que manda calcular tem widget na mesma fase', () => {
    for (const seed of LESSON_SEEDS) {
      for (const [phase, blocks] of Object.entries(seed.blocks?.phases ?? {})) {
        const asksToCalculate = blocks.some(
          (b) => b.type === 'text' && /\bcalcul(e|ar|em)\b/i.test(b.markup),
        )
        const hasWidget = blocks.some(
          (b) => b.type === 'widget' && b.widget !== 'callout' && b.widget !== 'platform-note',
        )
        expect(
          !asksToCalculate || hasWidget,
          `${seed.code} (${phase}) manda calcular sem widget`,
        ).toBe(true)
      }
    }
  })

  it('o upsert grava blocks e um reseed sem blocks volta a null (texto legado)', async () => {
    const { db, rows } = createFakeLessonsDb()
    const blocks = {
      schemaVersion: 1 as const,
      phases: {
        scenario: [{ type: 'text' as const, markup: 'oi' }],
        microDecision: [],
        revelation: [],
      },
    }

    await upsertLessonSeed(db, buildSeed({ stableKey: 'x', blocks }))
    expect(rows[0].blocks).toEqual(blocks)

    await upsertLessonSeed(db, buildSeed({ stableKey: 'x' }))
    expect(rows[0].blocks).toBeNull()
  })

  it('Trilha 2 na ordem da RC.4.3, com códigos e posições contíguos e sem repetição', () => {
    const trilha2 = LESSON_SEEDS.filter((l) => l.trackNumber === 2)
    expect(trilha2.map((l) => l.stableKey)).toEqual([
      '2.1',
      '2.3',
      '2.2',
      'b3-corretora-ordens',
      '2.5',
      '2.4',
      '2.6.1',
      '2.6.2',
      '2.6.5',
      '2.6.3',
      '2.6.4',
      '2.7',
      '2.6.6',
      '2.8',
      '2.9',
      '2.10',
      'custos-de-investir',
      'imposto-renda-variavel',
    ])
    expect(trilha2.map((l) => l.code)).toEqual([
      '2.1',
      '2.2',
      '2.3',
      '2.4',
      '2.5',
      '2.6',
      '2.7.1',
      '2.7.2',
      '2.7.3',
      '2.7.4',
      '2.7.5',
      '2.7.6',
      '2.7.7',
      '2.8',
      '2.9',
      '2.10',
      '2.11',
      '2.12',
    ])
    const orders = LESSON_SEEDS.map((l) => l.sortOrder)
    expect(orders).toEqual(orders.map((_, i) => i + 1))
    expect(new Set(LESSON_SEEDS.map((l) => l.code)).size).toBe(LESSON_SEEDS.length)
  })
})
