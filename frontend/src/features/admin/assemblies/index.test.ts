import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import type { AdminAssembly, AgendaTemplate, AssemblyPause, CatalogAsset } from '../../../services/admin'
import {
    ASSEMBLY_SETTING_TEXT,
    blankDraft,
    companyOptions,
    describeAssemblyError,
    describeEffect,
    describeOutcome,
    draftToContent,
    hasGlobalPause,
    pausedCompanyIds,
    pauseScopeLabel,
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

    it('vai e volta sem perder nada (a intensidade usa vírgula na tela)', () => {
        const draft = toDraft(template)
        expect(draft.options[0].intensity).toBe('0,8')
        expect(draft.options[1].direction).toBe('-1')
        const built = draftToContent(draft)
        expect(built).toEqual({
            content: {
                sector: null,
                title: 'Orçamento de capital',
                description: 'Descrição da pauta.',
                options: template.options,
            },
        })
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
            intensity: i === 0 ? '0.25' : ' 1 ',
        }))
        const built = draftToContent(draft)
        expect('content' in built && built.content.sector).toBe('Varejo')
        expect('content' in built && built.content.title).toBe('T')
        expect('content' in built && built.content.options.map((o) => o.effect.intensity)).toEqual([0.25, 1])
    })

    it.each([
        ['chave vazia', { key: '' }, /chave da opção 1/],
        ['rótulo vazio', { label: ' ' }, /rótulo, ganho e perda da opção 1/],
        ['intensidade vazia', { intensity: '' }, /intensidade da opção 1/],
        ['intensidade que não é número', { intensity: 'muita' }, /intensidade da opção 1/],
    ])('recusa %s antes de enviar', (_name, patch, message) => {
        const draft = toDraft(template)
        draft.options[0] = { ...draft.options[0], ...patch }
        const built = draftToContent(draft)
        expect('error' in built && built.error).toMatch(message)
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
