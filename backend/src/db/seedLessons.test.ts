import { describe, expect, it } from 'vitest'
import { isParallelTrack } from '../modules/lessons/domain/lesson'
import { countMainPathCards } from '../content/contentRules'
import { importLessonSeed, LESSON_SEEDS, type LessonSeed } from './seedLessons'
import { lessonBlocksSchema } from '../modules/lessons/infrastructure/content/lessonBlocks'
import { LESSON_SUMMARIES } from './lessonSummaries'
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
  it('todas as 43 lições do seed passam na validação de conteúdo do domínio (o painel não recusa o que o seed importa)', () => {
    expect(LESSON_SEEDS).toHaveLength(43)
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

describe('blocks no seed (RC.3.1)', () => {
  it('toda lição do seed com blocks respeita o contrato', () => {
    for (const seed of LESSON_SEEDS) {
      if (seed.blocks) {
        const result = lessonBlocksSchema.safeParse(seed.blocks)
        expect(result.success, `blocks inválido na lição ${seed.code}`).toBe(true)
      }
    }
  })

  it('toda lição do seed tem o resumo "O que ficou" (LJ.1.5)', () => {
    for (const seed of LESSON_SEEDS) {
      expect(seed.blocks?.summary, `sem summary na lição ${seed.code}`).toBeDefined()
    }
    // Nenhum resumo órfão: toda chave do arquivo de resumos é uma lição do seed.
    const keys = new Set(LESSON_SEEDS.map((s) => s.stableKey))
    expect(Object.keys(LESSON_SUMMARIES).filter((k) => !keys.has(k))).toEqual([])
  })

  // LJ.5.7: o caminho principal (cartões que o player conta; "Na plataforma" e "Saiba mais" colam no
  // cartão anterior) tem no máximo 15 cartões (teto subido de 12 pelo autor em 2026-10-18, ponto 057).
  // Lições acima disso entram aqui com a contagem de hoje: catraca, como o baseline de conteúdo. Lição
  // nova ou editada não pode passar de 15 nem crescer, e a que encolher falha até a linha baixar ou sair.
  const MAIN_PATH_CARD_LIMIT = 15
  const MAIN_PATH_BASELINE: Record<string, number> = {
    '2.12': 16,
    'F.2': 16,
  }

  it('o caminho principal de cada lição respeita o teto de cartões (baseline por lição)', () => {
    const counts: Record<string, number> = {}
    for (const seed of LESSON_SEEDS) {
      const total = Object.values(seed.blocks?.phases ?? {}).reduce(
        (sum, blocks) => sum + countMainPathCards(blocks),
        0,
      )
      if (total > MAIN_PATH_CARD_LIMIT || seed.code in MAIN_PATH_BASELINE) counts[seed.code] = total
    }
    expect(counts).toEqual(MAIN_PATH_BASELINE)
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

  it('o import grava blocks na primeira vez e um reimport nunca sobrescreve (N.23)', async () => {
    const { db, rows } = createFakeLessonsDb()
    const blocks = {
      schemaVersion: 1 as const,
      phases: {
        scenario: [{ type: 'text' as const, markup: 'oi' }],
        microDecision: [],
        revelation: [],
      },
    }

    await importLessonSeed(db, buildSeed({ stableKey: 'x', blocks }))
    expect(rows[0].blocks).toEqual(blocks)

    await importLessonSeed(db, buildSeed({ stableKey: 'x' }))
    expect(rows[0].blocks).toEqual(blocks)
  })

  it('lição sem blocks entra com blocks null (texto legado)', async () => {
    const { db, rows } = createFakeLessonsDb()
    await importLessonSeed(db, buildSeed({ stableKey: 'y' }))
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

  it('a Trilha 3 traz a lição de vieses antes do desafio final (RC.4.9)', () => {
    const trilha3 = LESSON_SEEDS.filter((l) => l.trackNumber === 3)
    expect(trilha3.map((l) => l.stableKey)).toEqual(['3.1', '3.2', '3.3', 'vieses-e-emocao', '3.4'])
    expect(trilha3.map((l) => l.code)).toEqual(['3.1', '3.2', '3.3', '3.4', '3.5'])
  })

  it('a Trilha F (paralela, RC.4.4) fica no fim do sortOrder e fora da corrente', () => {
    const parallel = LESSON_SEEDS.filter((l) => isParallelTrack(l.trackNumber))
    expect(parallel.map((l) => l.code)).toEqual(['F.1', 'F.2'])
    const lastChain = Math.max(
      ...LESSON_SEEDS.filter((l) => !isParallelTrack(l.trackNumber)).map((l) => l.sortOrder),
    )
    for (const lesson of parallel) {
      expect(lesson.sortOrder).toBeGreaterThan(lastChain)
      expect(lesson.unlocksKeys).toEqual([])
    }
  })
})

// Achado da RC.7.6: o seed falhou num banco real porque `stableKey` de 4 lições novas passava do
// limite da coluna (era varchar(20)). O fake acima não tem limite, então o teste confere o tamanho
// declarado em `lessons.stableKey` contra todos os seeds.
describe('tamanho das chaves dos seeds de lição', () => {
  it('todo stableKey e ticker cabe na coluna do banco', () => {
    const stableKeyLimit = lessons.stableKey.length as number
    const tickerLimit = lessons.microDecisionAssetTicker.length as number
    for (const seed of LESSON_SEEDS) {
      expect(seed.stableKey.length, seed.stableKey).toBeLessThanOrEqual(stableKeyLimit)
      if (seed.microDecisionAssetTicker) {
        expect(seed.microDecisionAssetTicker.length).toBeLessThanOrEqual(tickerLimit)
      }
      if (seed.unlocksAssetTicker) {
        expect(seed.unlocksAssetTicker.length).toBeLessThanOrEqual(
          lessons.unlocksAssetTicker.length as number,
        )
      }
    }
  })
})
