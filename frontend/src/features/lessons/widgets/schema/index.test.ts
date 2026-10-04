import { describe, expect, it } from 'vitest'
import { parseLessonBlocks, widgetPropsSchemas } from '.'

// Mesmo exemplo do teste de contrato do backend
// (`lessonBlocks.test.ts`, `CONTRACT_EXAMPLE`).
const CONTRACT_EXAMPLE = {
    schemaVersion: 1,
    phases: {
        scenario: [
            { type: 'text', markup: 'Você tem R$ 1.000 parados.' },
            {
                type: 'widget',
                id: 'dica-1',
                widget: 'callout',
                props: { tone: 'tip', title: 'Juros compostos', body: 'Juros sobre juros.', formula: 'M = C x (1 + i)^n' },
            },
        ],
        microDecision: [{ type: 'widget', id: 'calc', widget: 'growth-calculator', props: {} }],
        revelation: [
            { type: 'widget', id: 'ind', widget: 'live-indicator', props: { ticker: 'VALR3' }, caption: 'Indicadores de hoje' },
            { type: 'widget', id: 'macro', widget: 'live-macro', props: { windowDays: 90 } },
        ],
    },
}

describe('parseLessonBlocks', () => {
    it('aceita o exemplo do contrato', () => {
        expect(parseLessonBlocks(CONTRACT_EXAMPLE)?.phases.revelation).toHaveLength(2)
    })

    it.each([
        ['ausente', undefined],
        ['null', null],
        ['versão desconhecida', { ...CONTRACT_EXAMPLE, schemaVersion: 2 }],
        ['fase faltando', { schemaVersion: 1, phases: { scenario: [], microDecision: [] } }],
        ['lixo', { lixo: true }],
    ])('%s vira null (texto legado)', (_name, value) => {
        expect(parseLessonBlocks(value)).toBeNull()
    })
})

describe('widgetPropsSchemas', () => {
    it('callout assume o tom info', () => {
        expect(widgetPropsSchemas.callout.parse({ title: 'a', body: 'b' }).tone).toBe('info')
    })

    it('rejeita props inválidas', () => {
        expect(widgetPropsSchemas['live-indicator'].safeParse({}).success).toBe(false)
        expect(widgetPropsSchemas['growth-calculator'].safeParse({ a: 1 }).success).toBe(false)
    })
})
