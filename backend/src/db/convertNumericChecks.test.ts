import { describe, expect, it } from 'vitest'
import { replaceNumericChecks } from './convertNumericChecks'

const single = { type: 'check', id: 'q', kind: 'single', options: ['a', 'b'], answer: 0 }

describe('replaceNumericChecks', () => {
  it('troca a pergunta numeric pela versão do seed e preserva o resto', () => {
    const current = {
      schemaVersion: 1,
      phases: {
        scenario: [
          { type: 'text', markup: 'editado no painel' },
          { type: 'check', id: 'q', kind: 'numeric' },
        ],
      },
    }
    const { blocks, replaced } = replaceNumericChecks(current, { phases: { scenario: [single] } })
    expect(replaced).toBe(1)
    expect(blocks.phases?.scenario).toEqual([{ type: 'text', markup: 'editado no painel' }, single])
  })

  it('não mexe em pergunta numeric sem equivalente no seed e é idempotente', () => {
    const current = {
      phases: { scenario: [{ type: 'check', id: 'outra', kind: 'numeric' }, single] },
    }
    const first = replaceNumericChecks(current, { phases: { scenario: [single] } })
    expect(first.replaced).toBe(0)
    expect(first.blocks).toEqual(current)
  })
})
