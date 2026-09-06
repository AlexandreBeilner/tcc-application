import { describe, expect, it } from 'vitest'
import { glossary } from '.'

describe('glossary', () => {
    it('tem definição curta e não vazia pra cada termo do catálogo', () => {
        for (const [term, definition] of Object.entries(glossary)) {
            expect(definition.length).toBeGreaterThan(0)
            expect(definition.length).toBeLessThan(240)
            expect(term.length).toBeGreaterThan(0)
        }
    })

    it('cobre os termos recorrentes citados na tarefa C.1 do backlog', () => {
        for (const term of ['FGC', 'marcação a mercado', 'deságio', 'taxa bruta equivalente', 'EBIT', 'Dividend Yield']) {
            expect(glossary[term]).toBeDefined()
        }
    })
})
