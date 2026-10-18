import { describe, expect, it } from 'vitest'
import { parseLessonBlocks, widgetPropsSchemas } from '.'

// Mesmo exemplo do teste de contrato do backend
// (`lessonBlocks.test.ts`, `CONTRACT_EXAMPLE`).
const CONTRACT_EXAMPLE = {
    schemaVersion: 1,
    summary: ['Juros sobre juros fazem o tempo trabalhar a seu favor.', 'LCI isenta pode vencer o CDB.'],
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
        microDecision: [
            { type: 'widget', id: 'calc', widget: 'growth-calculator', props: {} },
            { type: 'check', id: 'q1', kind: 'single', prompt: 'Qual rende mais?', options: ['LCI', 'CDB'] },
            { type: 'check', id: 'q2', kind: 'true_false', prompt: 'LCI paga IR?', options: ['Verdadeiro', 'Falso'] },
        ],
        revelation: [
            { type: 'widget', id: 'ind', widget: 'live-indicator', props: { ticker: 'VALR3' }, caption: 'Indicadores de hoje' },
            { type: 'widget', id: 'macro', widget: 'live-macro', props: { windowDays: 90 } },
            {
                type: 'widget',
                id: 'nota-copom',
                widget: 'platform-note',
                props: {
                    brazil: 'O Copom se reúne 8 vezes por ano.',
                    here: 'As reuniões acontecem a cada 45 dias simulados.',
                    why: 'O tempo corre mais rápido para você ver o efeito dos juros.',
                },
            },
        ],
    },
}

describe('parseLessonBlocks', () => {
    it('aceita o exemplo do contrato', () => {
        expect(parseLessonBlocks(CONTRACT_EXAMPLE)?.phases.revelation).toHaveLength(3)
        expect(parseLessonBlocks(CONTRACT_EXAMPLE)?.phases.microDecision).toHaveLength(3)
    })

    it('mantém o resumo "O que ficou" e aceita a lição sem ele', () => {
        expect(parseLessonBlocks(CONTRACT_EXAMPLE)?.summary).toHaveLength(2)
        const { summary: _summary, ...withoutSummary } = CONTRACT_EXAMPLE
        expect(parseLessonBlocks(withoutSummary)?.summary).toBeUndefined()
    })

    it('aceita o "Saiba mais" com texto e widget, e recusa o vazio', () => {
        const more = (blocks: unknown[]) => ({ type: 'more', id: 'm', title: 'Detalhe', blocks })
        const withMore = (block: unknown) => ({
            ...CONTRACT_EXAMPLE,
            phases: { ...CONTRACT_EXAMPLE.phases, scenario: [{ type: 'text', markup: 'a' }, block] },
        })
        const widget = { type: 'widget', id: 'w', widget: 'callout', props: {} }

        expect(parseLessonBlocks(withMore(more([{ type: 'text', markup: 'x' }, widget])))?.phases.scenario).toHaveLength(2)
        expect(parseLessonBlocks(withMore(more([])))).toBeNull()
    })

    it('aceita a enquete com 2 a 4 alternativas e recusa fora disso (LJ.2.6)', () => {
        const poll = (options: string[]) => ({ type: 'poll', id: 'e', prompt: 'E você?', options, closing: 'A seguir.' })
        const withPoll = (block: unknown) => ({
            ...CONTRACT_EXAMPLE,
            phases: { ...CONTRACT_EXAMPLE.phases, scenario: [block] },
        })

        expect(parseLessonBlocks(withPoll(poll(['a', 'b'])))?.phases.scenario[0]).toMatchObject({ type: 'poll', id: 'e' })
        expect(parseLessonBlocks(withPoll(poll(['a', 'b', 'c', 'd'])))).not.toBeNull()
        expect(parseLessonBlocks(withPoll(poll(['só uma'])))).toBeNull()
        expect(parseLessonBlocks(withPoll(poll(['a', 'b', 'c', 'd', 'e'])))).toBeNull()
    })

    it('resumo fora do contrato (1 item ou frase longa) derruba o blocks para o texto legado', () => {
        expect(parseLessonBlocks({ ...CONTRACT_EXAMPLE, summary: ['só uma'] })).toBeNull()
        expect(parseLessonBlocks({ ...CONTRACT_EXAMPLE, summary: ['a', 'x'.repeat(121)] })).toBeNull()
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

    it('platform-note exige as três linhas', () => {
        expect(widgetPropsSchemas['platform-note'].safeParse({ brazil: 'a', here: 'b', why: 'c' }).success).toBe(true)
        expect(widgetPropsSchemas['platform-note'].safeParse({ brazil: 'a', here: 'b' }).success).toBe(false)
    })

    it('formula-walkthrough exige ao menos um item com fórmula, números e resultado', () => {
        const item = { label: 'Simples', formula: 'M = C', numbers: 'M = 1.000', result: 'R$ 1.000' }
        expect(widgetPropsSchemas['formula-walkthrough'].safeParse({ items: [item] }).success).toBe(true)
        expect(widgetPropsSchemas['formula-walkthrough'].safeParse({ items: [] }).success).toBe(false)
        expect(widgetPropsSchemas['formula-walkthrough'].safeParse({ items: [{ ...item, result: '' }] }).success).toBe(false)
    })

    it('rejeita props inválidas', () => {
        expect(widgetPropsSchemas['live-indicator'].safeParse({}).success).toBe(false)
        expect(widgetPropsSchemas['growth-calculator'].safeParse({ a: 1 }).success).toBe(false)
    })
})

describe('pergunta de estimativa (LJ.2.2)', () => {
    const estimate = { type: 'check', id: 'e1', kind: 'estimate', prompt: 'Quanto?', range: { min: 0, max: 100, step: 1, unit: 'brl' } }
    const withCheck = (check: unknown) => ({ schemaVersion: 1, phases: { scenario: [check], microDecision: [], revelation: [] } })

    it('aceita a régua e entrega o bloco com a unidade', () => {
        const parsed = parseLessonBlocks(withCheck(estimate))

        expect(parsed?.phases.scenario[0]).toMatchObject({ kind: 'estimate', range: { min: 0, max: 100, step: 1, unit: 'brl' } })
    })

    it.each([
        ['sem régua', { ...estimate, range: undefined }],
        ['passo zero', { ...estimate, range: { ...estimate.range, step: 0 } }],
        ['unidade desconhecida', { ...estimate, range: { ...estimate.range, unit: 'usd' } }],
    ])('cai no texto legado: %s', (_name, check) => {
        expect(parseLessonBlocks(withCheck(check))).toBeNull()
    })
})
