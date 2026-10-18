import { describe, expect, it } from 'vitest'
import { fillSummary } from './addLessonSummaries'

const summary = ['Uma ideia.', 'Outra ideia.']

describe('fillSummary', () => {
  it('preenche o resumo e preserva o resto do blocks', () => {
    const current = {
      schemaVersion: 1,
      phases: { scenario: [{ type: 'text', markup: 'editado' }] },
    }
    const { blocks, filled } = fillSummary(current, summary)
    expect(filled).toBe(true)
    expect(blocks).toEqual({ ...current, summary })
  })

  it('não sobrescreve resumo que já existe e é idempotente', () => {
    const current = { schemaVersion: 1, summary: ['Editado no painel.', 'Mais uma.'] }
    expect(fillSummary(current, summary)).toEqual({ blocks: current, filled: false })
    const first = fillSummary({ schemaVersion: 1 }, summary)
    expect(fillSummary(first.blocks, summary).filled).toBe(false)
  })

  it('não faz nada quando o seed não tem resumo', () => {
    const current = { schemaVersion: 1 }
    expect(fillSummary(current, undefined)).toEqual({ blocks: current, filled: false })
  })
})
