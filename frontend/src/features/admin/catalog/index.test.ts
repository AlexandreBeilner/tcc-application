import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import type { CatalogAsset } from '../../../services/admin'
import {
    buildCatalogPatch,
    catalogClassOf,
    describeCatalogError,
    describePatch,
    draftFromAsset,
    filterCatalog,
    orderedEditableFields,
} from '.'

const acao: CatalogAsset = {
    asset_id: 'a1',
    ticker: 'ACME3',
    name: 'Acme',
    type: 'acao',
    risk_class: null,
    is_sandbox: false,
    share_class: 'ON',
    outstanding_shares: 1000,
    editable: ['name', 'base_growth_pct', 'quality_multiplier'],
    company: { company_id: 'c1', name: 'Acme SA', sector: 'Varejo', report_frequency_days: 91, base_growth_pct: 3, quality_multiplier: 1 },
    etf: null,
    fii: null,
    fixed_income: null,
}
const etf: CatalogAsset = {
    ...acao,
    asset_id: 'e1',
    ticker: 'ETFX11',
    name: 'ETF X',
    type: 'etf',
    editable: ['name', 'methodology_summary'],
    company: null,
    etf: {
        benchmark_index: 'IBOV',
        methodology_summary: 'Replica.',
        expense_ratio_pct: 0.5,
        rebalance_frequency_days: 14,
        holdings: [],
        holdings_total_weight_pct: 0,
    },
}
const cdb: CatalogAsset = { ...acao, asset_id: 'r1', ticker: 'CDB1', name: 'CDB Um', type: 'cdb', editable: ['name'], company: null }

describe('filterCatalog', () => {
    const all = [acao, etf, cdb]

    it('filtra por classe, juntando os tipos de renda fixa', () => {
        expect(filterCatalog(all, { klass: 'renda_fixa', query: '' })).toEqual([cdb])
        expect(filterCatalog(all, { klass: 'etf', query: '' })).toEqual([etf])
        expect(filterCatalog(all, { klass: 'all', query: '' })).toHaveLength(3)
    })

    it('busca por ticker ou nome sem diferenciar caixa', () => {
        expect(filterCatalog(all, { klass: 'all', query: 'acme' })).toEqual([acao])
        expect(filterCatalog(all, { klass: 'all', query: 'cdb um' })).toEqual([cdb])
    })

    it('classifica os tipos de renda fixa', () => {
        expect(catalogClassOf('tesouro_ipca')).toBe('renda_fixa')
        expect(catalogClassOf('fii')).toBe('fii')
    })
})

describe('buildCatalogPatch', () => {
    it('sem mudança não gera patch', () => {
        expect(buildCatalogPatch(acao, draftFromAsset(acao))).toEqual({ patch: {}, errors: {} })
    })

    it('devolve só os campos que mudaram, aceitando vírgula decimal', () => {
        const draft = { ...draftFromAsset(acao), name: ' Acme Brasil ', base_growth_pct: '6,5' }
        expect(buildCatalogPatch(acao, draft).patch).toEqual({ name: 'Acme Brasil', base_growth_pct: 6.5 })
    })

    it.each([
        ['base_growth_pct', '-100', 'maior que -100'],
        ['base_growth_pct', 'alto', 'número'],
        ['quality_multiplier', '0', 'maior que 0'],
        ['quality_multiplier', '2,5', 'até 2'],
        ['name', '   ', 'caracteres'],
    ] as const)('recusa %s = %s antes de chamar o motor', (field, value, message) => {
        const result = buildCatalogPatch(acao, { ...draftFromAsset(acao), [field]: value })
        expect(result.errors[field]).toContain(message)
        expect(result.patch).toEqual({})
    })

    it('ignora campo que o ativo não permite editar', () => {
        const draft = { ...draftFromAsset(etf), base_growth_pct: '99' }
        expect(buildCatalogPatch(etf, draft)).toEqual({ patch: {}, errors: {} })
        expect(orderedEditableFields(etf)).toEqual(['name', 'methodology_summary'])
    })

    it('metodologia vazia limpa o texto', () => {
        expect(buildCatalogPatch(etf, { ...draftFromAsset(etf), methodology_summary: '' }).patch).toEqual({ methodology_summary: '' })
    })
})

describe('describePatch e describeCatalogError', () => {
    it('lista de/para de cada campo alterado', () => {
        expect(describePatch(acao, { name: 'Novo', quality_multiplier: 1.4 })).toEqual([
            'Nome: "Acme" para "Novo"',
            'Multiplicador de qualidade: 1 para 1,4',
        ])
    })

    it('mostra a mensagem do motor no 422 e texto fixo nos demais', () => {
        expect(describeCatalogError(new ApiError(422, 'ativo do sandbox não é editável'))).toContain('sandbox')
        expect(describeCatalogError(new ApiError(404, 'x'))).toContain('não existe')
        expect(describeCatalogError(new Error('boom'))).toContain('auditoria')
    })
})
