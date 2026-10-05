import { describe, expect, it } from 'vitest'
import { importLessonSeed, LESSON_SEEDS, type LessonSeed } from './seedLessons'
import { lessons } from './schema'
import type { Database } from './client'
import { checkLessonContent, contentOf } from '../modules/lessons/domain/lessonContent'

// Fake mínimo do subconjunto de `Database` que `importLessonSeed` usa
// (`insert(lessons).values(v).onConflictDoNothing({ target }).returning()`), reimplementando a
// semântica de `ON CONFLICT (<target>) DO NOTHING` do Postgres o suficiente pra provar o contrato da
// N.23: casar por `stableKey` e nunca sobrescrever uma lição existente.
function createFakeLessonsDb() {
  const rows: Array<Record<string, unknown>> = []

  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: ({ target }: { target: unknown }) => ({
          returning: async () => {
            if (target !== lessons.stableKey) {
              throw new Error('fake só reproduz onConflictDoNothing com target: lessons.stableKey')
            }
            if (rows.some((row) => row.stableKey === value.stableKey)) {
              return []
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

describe('importLessonSeed', () => {
  it('primeira execução insere uma linha nova', async () => {
    const { db, rows } = createFakeLessonsDb()

    const created = await importLessonSeed(db, buildSeed())

    expect(created).toBeDefined()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ stableKey: '1.3', code: '1.3' })
  })

  it('N.23: reexecutar o seed não desfaz edição feita pelo painel (conteúdo, code e posição ficam como estão)', async () => {
    const { db, rows } = createFakeLessonsDb()
    await importLessonSeed(db, buildSeed())
    const originalId = rows[0].id
    // O painel edita o conteúdo e a lição segue a vida.
    Object.assign(rows[0], {
      title: 'CDB e o CDI (editada no painel)',
      scenarioText: 'texto novo',
      code: '1.9',
      sortOrder: 20,
    })

    const second = await importLessonSeed(db, buildSeed())

    expect(second).toBeUndefined()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: originalId,
      title: 'CDB e o CDI (editada no painel)',
      scenarioText: 'texto novo',
      code: '1.9',
      sortOrder: 20,
    })
  })

  it('lição nova (stableKey novo) é inserida ao lado das existentes', async () => {
    const { db, rows } = createFakeLessonsDb()

    await importLessonSeed(db, buildSeed({ stableKey: '1.3', code: '1.3' }))
    await importLessonSeed(
      db,
      buildSeed({ stableKey: 'selic-formacao', code: '1.4', title: 'Como a Selic é formada' }),
    )

    expect(rows.map((row) => row.stableKey)).toEqual(['1.3', 'selic-formacao'])
  })
})

describe('LESSON_SEEDS', () => {
  it('todas as 35 lições do seed passam na validação de conteúdo do domínio (o painel não recusa o que o seed importa)', () => {
    expect(LESSON_SEEDS).toHaveLength(35)
    for (const seed of LESSON_SEEDS) {
      const { errors } = checkLessonContent(contentOf(seed))
      expect({ code: seed.code, errors }).toEqual({ code: seed.code, errors: [] })
    }
  })

  it('stableKey, code e sortOrder são únicos', () => {
    for (const key of ['stableKey', 'code', 'sortOrder'] as const) {
      expect(new Set(LESSON_SEEDS.map((s) => s[key])).size).toBe(LESSON_SEEDS.length)
    }
  })
})
