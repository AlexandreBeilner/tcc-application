import { describe, expect, it } from 'vitest'
import { REVISIONS, applyRevision, sameBlock } from './applyLessonRevisions'
import { LESSON_SEEDS } from './seedLessons'

const seed = {
  phases: {
    revelation: [
      { type: 'check', id: 'q', kind: 'single', prompt: 'nova', options: ['a', 'b'], answer: 1 },
      { type: 'widget', id: 'novo', widget: 'callout', props: { title: 't', body: 'b' } },
    ],
  },
}

const current = {
  schemaVersion: 1,
  phases: {
    scenario: [{ type: 'text', markup: 'editado no painel' }],
    revelation: [
      { type: 'text', markup: 'A meta é de 3%. Fim.' },
      { type: 'text', markup: 'Texto velho a remover.' },
      { type: 'widget', id: 'velho', widget: 'callout', props: {} },
      { type: 'check', id: 'q', kind: 'single', prompt: 'antiga', options: ['a', 'b'], answer: 0 },
    ],
  },
}

const revision = {
  code: 'x',
  texts: [['A meta é de 3%.', 'A meta é um alvo.']] as [string, string][],
  removeTexts: ['Texto velho'],
  removeIds: ['velho'],
  checks: ['q'],
  inserts: [{ id: 'novo', at: { afterText: 'um alvo' } }],
}

describe('applyRevision', () => {
  it('troca texto, remove blocos, troca a pergunta e insere o bloco do seed na âncora', () => {
    const { blocks, changes } = applyRevision(current, seed, revision)
    expect(changes).toBe(5)
    expect(blocks.phases?.scenario).toEqual([{ type: 'text', markup: 'editado no painel' }])
    expect(blocks.phases?.revelation).toEqual([
      { type: 'text', markup: 'A meta é um alvo. Fim.' },
      seed.phases.revelation[1],
      seed.phases.revelation[0],
    ])
  })

  it('é idempotente: rodar de novo não muda nada', () => {
    const first = applyRevision(current, seed, revision)
    const second = applyRevision(first.blocks, seed, revision)
    expect(second.changes).toBe(0)
    expect(second.blocks).toEqual(first.blocks)
  })

  it('não insere quando a âncora sumiu (texto editado pelo painel)', () => {
    const edited = { phases: { revelation: [{ type: 'text', markup: 'reescrito à mão' }] } }
    const { changes } = applyRevision(edited, seed, { code: 'x', inserts: revision.inserts })
    expect(changes).toBe(0)
  })

  it('pergunta igual com chaves em outra ordem (jsonb) não conta como mudança', () => {
    const reordered = {
      phases: {
        revelation: [
          {
            answer: 1,
            options: ['a', 'b'],
            prompt: 'nova',
            kind: 'single',
            id: 'q',
            type: 'check',
          },
        ],
      },
    }
    expect(sameBlock(reordered.phases.revelation[0], seed.phases.revelation[0])).toBe(true)
    expect(applyRevision(reordered, seed, { code: 'x', checks: ['q'] }).changes).toBe(0)
  })

  it('insere antes do id indicado', () => {
    const { blocks } = applyRevision(current, seed, {
      code: 'x',
      inserts: [{ id: 'novo', at: { before: 'q' } }],
    })
    const ids = blocks.phases?.revelation?.map((b) => b.id ?? b.type)
    expect(ids).toEqual(['text', 'text', 'velho', 'novo', 'q'])
  })
})

// As revisões precisam bater com o seed: aplicar uma revisão leva a lição ao texto do seed.
describe('REVISIONS', () => {
  const seedText = (code: string) =>
    JSON.stringify(LESSON_SEEDS.find((s) => s.code === code)?.blocks)

  it.each(REVISIONS.map((r) => [r.code, r] as const))('lição %s confere com o seed', (code, r) => {
    const text = seedText(code)
    expect(text).toBeDefined()
    for (const [from, to] of r.texts ?? []) {
      expect(text).toContain(JSON.stringify(to).slice(1, -1))
      expect(text).not.toContain(JSON.stringify(from).slice(1, -1))
    }
    for (const part of r.removeTexts ?? []) expect(text).not.toContain(part)
    for (const id of [...(r.checks ?? []), ...(r.inserts ?? []).map((i) => i.id)]) {
      expect(text).toContain(`"id":"${id}"`)
    }
    for (const id of r.removeIds ?? []) expect(text).not.toContain(`"id":"${id}"`)
  })
})
