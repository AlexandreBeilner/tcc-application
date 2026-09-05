import { describe, expect, it } from 'vitest'
import { buildMacroEventSummaryRows, buildTriggerMacroEventInput, createEmptyMacroEventDraft, validateMacroEventDraft } from '.'
import type { MacroEventDraft } from '.'

function draftWithTarget(overrides: Partial<MacroEventDraft> = {}): MacroEventDraft {
    return {
        ...createEmptyMacroEventDraft(),
        targets: [{ id: 't1', kind: 'sector', value: 'Mineração' }],
        ...overrides,
    }
}

describe('validateMacroEventDraft', () => {
    it('modo template exige template_key', () => {
        const draft = draftWithTarget({ mode: 'template', templateKey: '' })
        expect(validateMacroEventDraft(draft)).toContain('Selecione um template do catálogo.')
    })

    it('modo template com template_key e alvo válido não tem erro', () => {
        const draft = draftWithTarget({ mode: 'template', templateKey: 'alta-minerio-ferro' })
        expect(validateMacroEventDraft(draft)).toEqual([])
    })

    it('modo avulso exige título, narrativa e ao menos um efeito', () => {
        const draft = draftWithTarget({
            mode: 'adhoc',
            title: '',
            narrative: '',
            affectsPrice: false,
            affectsFundamentals: false,
        })
        const errors = validateMacroEventDraft(draft)
        expect(errors).toContain('Informe o título do evento.')
        expect(errors).toContain('Informe a narrativa do evento.')
        expect(errors).toContain('Selecione ao menos um tipo de efeito (preço e/ou fundamentos).')
    })

    it('modo avulso rejeita título maior que 150 caracteres', () => {
        const draft = draftWithTarget({ mode: 'adhoc', title: 'x'.repeat(151), narrative: 'narrativa' })
        expect(validateMacroEventDraft(draft)).toContain('O título pode ter no máximo 150 caracteres.')
    })

    it('exige ao menos um alvo', () => {
        const draft = draftWithTarget({ mode: 'template', templateKey: 'alta-minerio-ferro', targets: [] })
        expect(validateMacroEventDraft(draft)).toContain('Adicione ao menos um alvo.')
    })

    it('rejeita alvo sem valor preenchido', () => {
        const draft = draftWithTarget({
            mode: 'template',
            templateKey: 'alta-minerio-ferro',
            targets: [{ id: 't1', kind: 'sector', value: '' }],
        })
        expect(validateMacroEventDraft(draft)).toContain('Preencha o valor de todos os alvos (ou remova a linha vazia).')
    })
})

describe('buildTriggerMacroEventInput', () => {
    it('modo template só envia template_key e targets', () => {
        const draft = draftWithTarget({ mode: 'template', templateKey: 'alta-minerio-ferro' })
        expect(buildTriggerMacroEventInput(draft)).toEqual({
            template_key: 'alta-minerio-ferro',
            targets: [{ sector: 'Mineração' }],
        })
    })

    it('modo avulso envia todos os campos, com título/narrativa aparados', () => {
        const draft = draftWithTarget({
            mode: 'adhoc',
            title: '  Título  ',
            narrative: '  Narrativa  ',
            direction: 'positivo',
            magnitudeBand: 'severo',
            affectsPrice: true,
            affectsFundamentals: true,
            targets: [{ id: 't1', kind: 'asset', value: 'asset-1' }],
        })
        expect(buildTriggerMacroEventInput(draft)).toEqual({
            title: 'Título',
            narrative: 'Narrativa',
            direction: 'positivo',
            magnitude_band: 'severo',
            affects_price: true,
            affects_fundamentals: true,
            targets: [{ asset_id: 'asset-1' }],
        })
    })

    it('traduz cada kind de alvo pro campo correto', () => {
        const draft = draftWithTarget({
            mode: 'template',
            templateKey: 'alta-minerio-ferro',
            targets: [
                { id: 't1', kind: 'sector', value: 'Mineração' },
                { id: 't2', kind: 'risk_class', value: 'Sofisticado' },
                { id: 't3', kind: 'asset', value: 'asset-1' },
            ],
        })
        expect(buildTriggerMacroEventInput(draft).targets).toEqual([
            { sector: 'Mineração' },
            { risk_class: 'Sofisticado' },
            { asset_id: 'asset-1' },
        ])
    })
})

describe('buildMacroEventSummaryRows', () => {
    it('modo template resolve o título/direção/magnitude/efeitos do catálogo', () => {
        const draft = draftWithTarget({ mode: 'template', templateKey: 'alta-minerio-ferro' })
        const rows = buildMacroEventSummaryRows(draft)

        expect(rows).toEqual([
            { label: 'Template', value: 'Minério de ferro dispara no mercado internacional' },
            { label: 'Direção', value: 'Alta' },
            { label: 'Magnitude', value: 'Moderado' },
            { label: 'Efeitos', value: 'Preço + Fundamentos' },
            { label: 'Alvos', value: 'Setor: Mineração' },
        ])
    })

    it('modo template sem template selecionado ainda mostra placeholder', () => {
        const draft = draftWithTarget({ mode: 'template', templateKey: '' })
        expect(buildMacroEventSummaryRows(draft)[0]).toEqual({ label: 'Template', value: '(nenhum selecionado)' })
    })

    it('modo avulso usa os campos do próprio draft', () => {
        const draft = draftWithTarget({
            mode: 'adhoc',
            title: 'Título avulso',
            direction: 'negativo',
            magnitudeBand: 'severo',
            affectsPrice: false,
            affectsFundamentals: true,
        })
        expect(buildMacroEventSummaryRows(draft)).toEqual([
            { label: 'Título', value: 'Título avulso' },
            { label: 'Direção', value: 'Baixa' },
            { label: 'Magnitude', value: 'Severo' },
            { label: 'Efeitos', value: 'Fundamentos' },
            { label: 'Alvos', value: 'Setor: Mineração' },
        ])
    })

    it('resolve alvo do tipo asset via assetLabels', () => {
        const draft = draftWithTarget({
            mode: 'template',
            templateKey: 'alta-minerio-ferro',
            targets: [{ id: 't1', kind: 'asset', value: 'a1' }],
        })
        const rows = buildMacroEventSummaryRows(draft, { a1: 'BNDD4 · Banco D S.A.' })
        expect(rows.find((row) => row.label === 'Alvos')).toEqual({ label: 'Alvos', value: 'BNDD4 · Banco D S.A.' })
    })

    it('ignora alvos ainda sem valor preenchido na prévia', () => {
        const draft = draftWithTarget({
            mode: 'template',
            templateKey: 'alta-minerio-ferro',
            targets: [{ id: 't1', kind: 'sector', value: '' }],
        })
        expect(buildMacroEventSummaryRows(draft).find((row) => row.label === 'Alvos')).toEqual({ label: 'Alvos', value: '(nenhum)' })
    })
})
