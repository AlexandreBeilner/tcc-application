import { describe, expect, it } from 'vitest'
import type { LessonSummary, UserCheckpointRecord } from './lesson'
import { buildRecallView, selectRecall } from './recall'

function lesson(n: number, track = 0, checks: string[] = [`q${n}`]): LessonSummary {
  return {
    id: `l${n}`,
    code: `${track}.${n}`,
    title: `Lição ${n}`,
    trackNumber: track,
    trackName: `Trilha ${track}`,
    sortOrder: n,
    centralConcept: 'x',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    blocks: {
      schemaVersion: 1,
      phases: {
        scenario: checks.map((id) => ({
          type: 'check' as const,
          id,
          kind: 'single' as const,
          prompt: `pergunta ${id}`,
          options: ['a', 'b'],
          answer: 0,
          explanation: 'segredo',
        })),
        microDecision: [],
        revelation: [],
      },
    },
  }
}

function record(
  lessonId: string,
  checkpointId: string,
  overrides: Partial<UserCheckpointRecord> = {},
): UserCheckpointRecord {
  return {
    lessonId,
    checkpointId,
    attempts: 1,
    wrongOptions: [],
    solvedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

const NOW = new Date('2026-02-01T12:00:00Z')
// Errou e está vencida na fila de revisão (LJ.5.6).
const DUE = { reviewStage: 0, reviewDueAt: new Date('2026-01-02T00:00:00Z') }

const lessons = [1, 2, 3, 4, 5, 6, 7].map((n) => lesson(n))
const done = (...ns: number[]) => new Set(ns.map((n) => `l${n}`))

describe('selectRecall', () => {
  it('não há pergunta na primeira lição da trilha', () => {
    expect(
      selectRecall({
        seed: 's',
        now: NOW,
        current: lessons[0],
        lessons,
        completedLessonIds: done(),
        checkpoints: [],
      }),
    ).toBeUndefined()
  })

  it('a primeira lição de outra trilha também não tem, mesmo com lições concluídas antes', () => {
    const all = [...lessons.slice(0, 3), lesson(4, 1), lesson(5, 1)]
    expect(
      selectRecall({
        seed: 's',
        now: NOW,
        current: all[3],
        lessons: all,
        completedLessonIds: done(1, 2, 3),
        checkpoints: [],
      }),
    ).toBeUndefined()
    expect(
      selectRecall({
        seed: 's',
        now: NOW,
        current: all[4],
        lessons: all,
        completedLessonIds: done(1, 2, 3, 4),
        checkpoints: [],
      }),
    ).toBeDefined()
  })

  it('prefere uma pergunta errada e vencida na revisão, mesmo de uma lição fora da janela', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[6],
      lessons,
      completedLessonIds: done(1, 2, 3, 4, 5, 6),
      checkpoints: [record('l1', 'q1', { attempts: 3, ...DUE }), record('l5', 'q5')],
    })
    expect(result).toEqual({ lessonId: 'l1', checkpointId: 'q1' })
  })

  it('erro em lição não concluída nunca é escolhido', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[3],
      lessons,
      completedLessonIds: done(1),
      checkpoints: [record('l2', 'q2', { attempts: 4 })],
    })
    // l2 não está concluída: cai no sorteio da janela, que só tem lição concluída (l1 está 3 atrás).
    expect(result).toEqual({ lessonId: 'l1', checkpointId: 'q1' })
  })

  it('erro em lição posterior à atual nunca é escolhido', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[2],
      lessons,
      completedLessonIds: done(1, 2, 4),
      checkpoints: [record('l4', 'q4', { attempts: 4 })],
    })
    expect(result?.lessonId).not.toBe('l4')
  })

  it('pergunta errada que ainda não venceu na revisão não é preferida (acertou há pouco)', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[6],
      lessons,
      completedLessonIds: done(1, 2, 3, 4, 5, 6),
      checkpoints: [
        record('l1', 'q1', {
          attempts: 3,
          reviewStage: 1,
          reviewDueAt: new Date('2026-02-03T00:00:00Z'),
        }),
      ],
    })
    // Sorteio na janela de 2 a 5 atrás (l2 a l5): l1 está fora dela.
    expect(['l2', 'l3', 'l4', 'l5']).toContain(result?.lessonId)
  })

  it('pergunta errada que já saiu da fila de revisão (fixada) não é preferida', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[6],
      lessons,
      completedLessonIds: done(1, 2, 3, 4, 5, 6),
      checkpoints: [record('l1', 'q1', { attempts: 3, reviewStage: 3, reviewDueAt: null })],
    })
    expect(['l2', 'l3', 'l4', 'l5']).toContain(result?.lessonId)
  })

  it('no mesmo dia, lições diferentes não recebem sempre a mesma pergunta', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      lesson(i + 1, 0, [`q${i + 1}a`, `q${i + 1}b`]),
    )
    const picks = new Set(
      many.slice(6).map((current) =>
        JSON.stringify(
          selectRecall({
            seed: 'u|2026-10-23',
            now: NOW,
            current,
            lessons: many,
            completedLessonIds: new Set(many.map((l) => l.id)),
            checkpoints: [],
          }),
        ),
      ),
    )
    expect(picks.size).toBeGreaterThan(1)
  })

  it('pergunta que sumiu do conteúdo é ignorada', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[3],
      lessons,
      completedLessonIds: done(1, 2, 3),
      checkpoints: [record('l1', 'velha', { attempts: 3 })],
    })
    expect(result?.checkpointId).not.toBe('velha')
  })

  it('pergunta ainda não resolvida não conta como errada', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[2],
      lessons,
      completedLessonIds: done(1, 2),
      checkpoints: [record('l1', 'q1', { attempts: 3, solvedAt: null })],
    })
    // Sem erro de verdade, vem da janela: l1 está 2 atrás.
    expect(result).toEqual({ lessonId: 'l1', checkpointId: 'q1' })
  })

  it.each([
    ['estimativa fora da tolerância', { lastResponse: { kind: 'estimate', value: 1, hit: false } }],
    ['ligar com erro', { attempts: 6, lastResponse: { kind: 'match', pairs: [], misses: 2 } }],
  ] as const)('conta como errada: %s', (_name, overrides) => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[6],
      lessons,
      completedLessonIds: done(1, 2, 3, 4, 5, 6),
      checkpoints: [
        record('l1', 'q1', { ...(overrides as Partial<UserCheckpointRecord>), ...DUE }),
        record('l2', 'q2'),
      ],
    })
    expect(result).toEqual({ lessonId: 'l1', checkpointId: 'q1' })
  })

  it('ligar sem erro e estimativa na mosca não contam como erradas', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[6],
      lessons,
      completedLessonIds: done(1, 2, 3, 4, 5, 6),
      checkpoints: [
        record('l1', 'q1', { attempts: 6, lastResponse: { kind: 'match', pairs: [], misses: 0 } }),
        record('l2', 'q2', { lastResponse: { kind: 'estimate', value: 1, hit: true } }),
      ],
    })
    // Sem erro: sorteio na janela de 2 a 5 atrás (l2 a l5).
    expect(['l2', 'l3', 'l4', 'l5']).toContain(result?.lessonId)
  })

  it('sem erro, sorteia só entre as lições de 2 a 5 atrás', () => {
    const picked = new Set<string>()
    for (let i = 0; i < 60; i += 1) {
      const result = selectRecall({
        seed: `seed-${i}`,
        now: NOW,
        current: lessons[6],
        lessons,
        completedLessonIds: done(1, 2, 3, 4, 5, 6),
        checkpoints: [],
      })
      picked.add(result?.lessonId as string)
    }
    // l7 é a atual (posição 6): 1 atrás é l6, 2 a 5 atrás são l5, l4, l3, l2.
    expect([...picked].sort()).toEqual(['l2', 'l3', 'l4', 'l5'])
  })

  it('sem nada na janela de 2 a 5, usa a lição imediatamente anterior', () => {
    const result = selectRecall({
      seed: 's',
      now: NOW,
      current: lessons[1],
      lessons,
      completedLessonIds: done(1),
      checkpoints: [],
    })
    expect(result).toEqual({ lessonId: 'l1', checkpointId: 'q1' })
  })

  it('é determinística pela semente e muda com ela', () => {
    const run = (seed: string) =>
      selectRecall({
        seed,
        current: lessons[6],
        lessons,
        completedLessonIds: done(1, 2, 3, 4, 5, 6),
        checkpoints: [],
      })
    expect(run('u|2026-10-18')).toEqual(run('u|2026-10-18'))
    const seeds = Array.from({ length: 30 }, (_, i) => JSON.stringify(run(`u|dia-${i}`)))
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('sem lição concluída antes, não há pergunta', () => {
    expect(
      selectRecall({
        seed: 's',
        now: NOW,
        current: lessons[3],
        lessons,
        completedLessonIds: done(),
        checkpoints: [],
      }),
    ).toBeUndefined()
  })
})

describe('buildRecallView', () => {
  it('devolve o título da lição de origem e a pergunta sem gabarito', () => {
    const view = buildRecallView({ lessonId: 'l2', checkpointId: 'q2' }, lessons)
    expect(view).toMatchObject({ lessonId: 'l2', lessonTitle: 'Lição 2' })
    expect(view?.block).toMatchObject({ id: 'q2', kind: 'single', options: ['a', 'b'] })
    expect(JSON.stringify(view)).not.toContain('segredo')
    expect(view?.block).not.toHaveProperty('answer')
  })

  it('lição ou pergunta inexistente dá nada', () => {
    expect(buildRecallView({ lessonId: 'zz', checkpointId: 'q2' }, lessons)).toBeUndefined()
    expect(buildRecallView({ lessonId: 'l2', checkpointId: 'zz' }, lessons)).toBeUndefined()
  })
})
