import { describe, expect, it } from 'vitest'
import { glossary } from '.'

describe('glossary', () => {
    it('tem definição curta e não vazia pra cada termo do catálogo', () => {
        for (const [term, definition] of Object.entries(glossary)) {
            expect(definition.definition.length).toBeGreaterThan(0)
            expect(definition.definition.length).toBeLessThan(240)
            expect(term.length).toBeGreaterThan(0)
        }
    })

    it('cobre o glossário ampliado (RC.3.5) com os termos que as lições novas definem', () => {
        expect(Object.keys(glossary).length).toBeGreaterThanOrEqual(40)
        for (const term of ['Selic', 'CDI', 'TR', 'IPCA', 'ticker', 'ON e PN', 'valor de face', 'VNA', 'JCP', 'NAV', 'duration']) {
            expect(glossary[term], term).toBeDefined()
        }
    })

    it('exemplo, quando existe, é curto', () => {
        for (const entry of Object.values(glossary)) {
            if (entry.example) expect(entry.example.length).toBeLessThan(200)
        }
    })

    it('cobre os termos recorrentes citados na tarefa C.1 do backlog', () => {
        for (const term of ['FGC', 'marcação a mercado', 'deságio', 'taxa bruta equivalente', 'EBIT', 'Dividend Yield']) {
            expect(glossary[term]).toBeDefined()
        }
    })
})
