import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import type { AdminAssembly, AgendaTemplate, AssemblyPause, CatalogAsset } from '../../../services/admin'
import type { TemplateDraft } from './types'
import {
    ASSEMBLY_SETTING_TEXT,
    blankDraft,
    companyOptions,
    describeAssemblyError,
    describeEffect,
    describeEffectPreview,
    describeOutcome,
    draftToContent,
    hasGlobalPause,
    pausedCompanyIds,
    pauseScopeLabel,
    readTemplateEffects,
    suggestKey,
    toDraft,
    unitFor,
} from '.'

const assembly = (overrides: Partial<AdminAssembly> = {}): AdminAssembly => ({
    id: 'a1',
    kind: 'shareholder',
    subject_ref: 'c1',
    subject_label: 'Acme',
    title: 'Pauta',
    status: 'closed',
    opens_at: '2026-10-01T00:00:00Z',
    closes_at: '2026-10-08T00:00:00Z',
    effect_applies_at: '2026-10-09T00:00:00Z',
    effect_applied_at: null,
    outcome: 'approved',
    outcome_reason: 'decided',
    voter_count: 3,
    winning_option_id: 'o1',
    min_voters: 3,
    effect_pending: false,
    paused: false,
    declaration_id: null,
    dividend_on_hold: false,
    ...overrides,
})

const pause = (overrides: Partial<AssemblyPause> = {}): AssemblyPause => ({
    id: 'p1',
    scope: 'global',
    company_id: null,
    reason: 'motivo',
    created_by: 'admin-1',
    created_at: '2026-10-01T00:00:00Z',
    lifted_at: null,
    lifted_by: null,
    ...overrides,
})

describe('texto dos parâmetros', () => {
    it('nenhum texto da interface usa travessão como pontuação', () => {
        for (const text of Object.values(ASSEMBLY_SETTING_TEXT)) {
            expect(`${text.title} ${text.unit} ${text.effect}`).not.toMatch(/[–—]/)
        }
    })
})

describe('resultado e efeito', () => {
    it('descreve o resultado de uma encerrada', () => {
        expect(describeOutcome(assembly())).toBe('Aprovada')
        expect(describeOutcome(assembly({ outcome: 'not_approved', outcome_reason: 'quorum' }))).toBe(
            'Não aprovada: Sem o mínimo de votantes',
        )
        expect(describeOutcome(assembly({ outcome: 'not_approved', outcome_reason: 'tie' }))).toBe('Não aprovada: Empate (nada muda)')
        expect(describeOutcome(assembly({ status: 'open', outcome: null, outcome_reason: null }))).toBe('—')
    })

    it('o efeito só existe para aprovada e distingue aplicado, pendente e agendado', () => {
        expect(describeEffect(assembly({ outcome: 'not_approved' }))).toBeNull()
        expect(describeEffect(assembly({ effect_applied_at: '2026-10-09T01:00:00Z' }))).toBe('Efeito aplicado')
        expect(describeEffect(assembly({ effect_pending: true }))).toBe('Efeito pendente')
        expect(describeEffect(assembly())).toBe('Efeito agendado')
    })
})

describe('pausas', () => {
    it('reconhece a global e as empresas pausadas', () => {
        const active = [pause(), pause({ id: 'p2', scope: 'company', company_id: 'c1' })]
        expect(hasGlobalPause(active)).toBe(true)
        expect(hasGlobalPause([pause({ scope: 'company', company_id: 'c1' })])).toBe(false)
        expect([...pausedCompanyIds(active)]).toEqual(['c1'])
    })

    it('nomeia o escopo pela empresa quando ela é conhecida', () => {
        const names = new Map([['c1', 'Acme']])
        expect(pauseScopeLabel(pause(), names)).toBe('Todas as assembleias')
        expect(pauseScopeLabel(pause({ scope: 'company', company_id: 'c1' }), names)).toBe('Acme')
        expect(pauseScopeLabel(pause({ scope: 'company', company_id: 'zzz' }), names)).toBe('Uma empresa')
    })

    it('lista cada empresa uma vez (ON e PN dividem a mesma) em ordem alfabética', () => {
        const asset = (id: string, name: string | null) => ({ company: name ? { company_id: id, name } : null }) as unknown as CatalogAsset
        expect(companyOptions([asset('c2', 'Beta'), asset('c1', 'Acme'), asset('c1', 'Acme'), asset('x', null)])).toEqual([
            { id: 'c1', name: 'Acme' },
            { id: 'c2', name: 'Beta' },
        ])
        expect(companyOptions(undefined)).toEqual([])
    })
})

describe('describeAssemblyError', () => {
    it('usa a mensagem de regra do backend no 422 e textos fixos nos demais', () => {
        expect(describeAssemblyError(new ApiError(422, 'valor deve ser um inteiro de 1 a 1000'))).toBe(
            'valor deve ser um inteiro de 1 a 1000',
        )
        expect(describeAssemblyError(new ApiError(409, 'x'))).toMatch(/estado mudou/)
        expect(describeAssemblyError(new ApiError(404, 'x'))).toMatch(/não existe mais/)
        expect(describeAssemblyError(new Error('rede'))).toMatch(/Não foi possível/)
    })
})

describe('rascunho de pauta', () => {
    const template: AgendaTemplate = {
        key: 'capital_budget',
        purpose: 'general',
        sector: null,
        title: 'Orçamento de capital',
        description: 'Descrição da pauta.',
        active: true,
        created_at: '2026-10-01T00:00:00Z',
        usage: { assemblies: 1, active_proposals: 0 },
        options: [
            {
                key: 'expandir',
                label: 'Ampliar',
                gain: 'g',
                loss: 'l',
                effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.8 },
            },
            {
                key: 'eficiencia',
                label: 'Eficiência',
                gain: 'g',
                loss: 'l',
                effect: { metric: 'quality_multiplier', direction: -1, intensity: 0.5 },
            },
        ],
    }

    it('vai e volta sem perder nada (a intensidade usa vírgula na tela) e o efeito antigo vira lista', () => {
        const draft = toDraft(template)
        expect(draft.purpose).toBe('general')
        expect(draft.options[0].effects).toEqual([{ metric: 'base_growth_pct', direction: '1', intensity: '0,8', value: 'quarterly' }])
        expect(draft.options[1].effects[0].direction).toBe('-1')
        const built = draftToContent(draft)
        expect(built).toEqual({
            content: {
                purpose: 'general',
                sector: null,
                title: 'Orçamento de capital',
                description: 'Descrição da pauta.',
                options: template.options.map((o) => ({ ...o, effect: { effects: [o.effect] } })),
            },
        })
    })

    it('lê os dois formatos de efeito (a lista nova e o objeto antigo)', () => {
        const one = { metric: 'payout_ratio_pct', direction: -1, intensity: 1 }
        const two = { metric: 'dividend_policy', value: 'annual' }
        expect(readTemplateEffects(one)).toEqual([one])
        expect(readTemplateEffects({ effects: [one, two] })).toEqual([one, two])
    })

    it('pauta de destinação do lucro vai e volta com dois efeitos e a política com o valor-alvo', () => {
        const profit: AgendaTemplate = {
            ...template,
            purpose: 'profit',
            options: [
                {
                    key: 'reinvestir',
                    label: 'Reinvestir',
                    gain: 'g',
                    loss: 'l',
                    effect: {
                        effects: [
                            { metric: 'payout_ratio_pct', direction: -1, intensity: 1 },
                            { metric: 'dividend_policy', value: 'semiannual' },
                        ],
                    },
                },
                {
                    key: 'distribuir',
                    label: 'Distribuir',
                    gain: 'g',
                    loss: 'l',
                    effect: { effects: [{ metric: 'pn_dividend_premium_pct', direction: 1, intensity: 0.5 }] },
                },
            ],
        }
        const draft = toDraft(profit)
        expect(draft.purpose).toBe('profit')
        expect(draft.options[0].effects.map((e) => e.metric)).toEqual(['payout_ratio_pct', 'dividend_policy'])
        expect(draft.options[0].effects[1].value).toBe('semiannual')
        const built = draftToContent(draft)
        expect('content' in built && built.content.purpose).toBe('profit')
        expect('content' in built && built.content.options.map((o) => o.effect)).toEqual(profit.options.map((o) => o.effect))
    })

    it('aceita ponto ou vírgula e apara os textos', () => {
        const draft = blankDraft()
        draft.title = '  T  '
        draft.sector = '  Varejo '
        draft.options = draft.options.map((o, i) => ({
            ...o,
            key: `op${i}`,
            label: 'L',
            gain: 'g',
            loss: 'l',
            effects: [{ ...o.effects[0], intensity: i === 0 ? '0.25' : ' 1 ' }],
        }))
        const built = draftToContent(draft)
        expect('content' in built && built.content.sector).toBe('Varejo')
        expect('content' in built && built.content.title).toBe('T')
        expect('content' in built && built.content.options.map((o) => 'effects' in o.effect && o.effect.effects[0].intensity)).toEqual([
            0.25, 1,
        ])
    })

    it.each([
        ['chave vazia', (d: TemplateDraft) => void (d.options[0].key = ''), /chave da opção 1/],
        ['rótulo vazio', (d: TemplateDraft) => void (d.options[0].label = ' '), /rótulo, ganho e perda da opção 1/],
        ['intensidade vazia', (d: TemplateDraft) => void (d.options[0].effects[0].intensity = ''), /intensidade da opção 1/],
        [
            'intensidade que não é número',
            (d: TemplateDraft) => void (d.options[0].effects[0].intensity = 'muita'),
            /intensidade da opção 1/,
        ],
        [
            'a mesma alavanca duas vezes',
            (d: TemplateDraft) => void d.options[0].effects.push({ ...d.options[0].effects[0], direction: '-1' }),
            /não pode mexer na mesma alavanca duas vezes/,
        ],
    ])('recusa %s antes de enviar', (_name, mutate, message) => {
        const draft = toDraft(template)
        mutate(draft)
        const built = draftToContent(draft)
        expect('error' in built && built.error).toMatch(message)
    })

    it('a política não precisa de intensidade, e a intensidade em branco não a impede', () => {
        const draft = toDraft(template)
        draft.options[0].effects = [{ metric: 'dividend_policy', direction: '1', intensity: '', value: 'annual' }]
        const built = draftToContent(draft)
        expect('content' in built && built.content.options[0].effect).toEqual({ effects: [{ metric: 'dividend_policy', value: 'annual' }] })
    })

    it('descreve o efeito de uma opção no painel, inclusive a política', () => {
        expect(describeEffectPreview({ metric: 'payout', direction: -1, intensity: 1 })).toBe('payout desce, intensidade 1')
        expect(describeEffectPreview({ metric: 'pn_premium', direction: 1, intensity: 0.5 })).toBe(
            'prêmio da ação PN sobe, intensidade 0,5',
        )
        expect(describeEffectPreview({ metric: 'dividend_policy', value: 'semiannual' })).toBe('política de dividendo vira semestral')
    })

    it('sugere a chave a partir do título, sem acento nem símbolos', () => {
        expect(suggestKey('Política de endividamento!')).toBe('politica_de_endividamento')
        expect(suggestKey('  Orçamento & Capital  ')).toBe('orcamento_capital')
        expect(suggestKey('x'.repeat(90))).toHaveLength(60)
    })
})

describe('unitFor', () => {
    it('usa o singular só para o número 1', () => {
        expect(unitFor('dias reais', 1)).toBe('dia real')
        expect(unitFor('dias simulados', 1)).toBe('dia simulado')
        expect(unitFor('pessoas', 1)).toBe('pessoa')
        expect(unitFor('dias reais', 7)).toBe('dias reais')
        expect(unitFor('dias reais', 0)).toBe('dias reais')
    })

    it('unidade sem plural (nível, XP) fica como está', () => {
        expect(unitFor('nível', 1)).toBe('nível')
        expect(unitFor('XP', 1)).toBe('XP')
    })
})
