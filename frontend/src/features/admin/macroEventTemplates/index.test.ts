import { describe, expect, it } from 'vitest'
import { MACRO_EVENT_TEMPLATES, findMacroEventTemplate } from '.'

describe('macroEventTemplates', () => {
    it('tem os 10 templates do catálogo inicial (spec 3.3.2)', () => {
        expect(MACRO_EVENT_TEMPLATES).toHaveLength(10)
    })

    it('cada template tem chave única e pelo menos um efeito habilitado', () => {
        const keys = new Set(MACRO_EVENT_TEMPLATES.map((template) => template.key))
        expect(keys.size).toBe(MACRO_EVENT_TEMPLATES.length)

        for (const template of MACRO_EVENT_TEMPLATES) {
            expect(template.affectsPrice || template.affectsFundamentals).toBe(true)
        }
    })

    it('findMacroEventTemplate encontra pela chave', () => {
        expect(findMacroEventTemplate('alta-minerio-ferro')?.title).toBe('Minério de ferro dispara no mercado internacional')
    })

    it('findMacroEventTemplate devolve undefined pra chave desconhecida', () => {
        expect(findMacroEventTemplate('inexistente')).toBeUndefined()
    })
})
