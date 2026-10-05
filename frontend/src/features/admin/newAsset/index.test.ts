import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { buildNewAsset, defaultNewAssetDraft, describeNewAssetError, holdingsTotal } from '.'
import type { NewAssetDraft } from '.'

const draft = (overrides: Partial<NewAssetDraft> = {}): NewAssetDraft => ({ ...defaultNewAssetDraft(), ...overrides })

const equity = draft({
    ticker: ' nova3 ',
    name: 'Nova ON',
    company_name: 'Nova S.A.',
    cnpj: '44.555.666/0001-77',
    outstanding_shares: '200000000',
    base_growth_pct: '6,5',
})

describe('buildNewAsset', () => {
    it('ação: monta o pedido com ticker em maiúsculas, CNPJ só com dígitos e vírgula decimal', () => {
        expect(buildNewAsset('acao', equity)).toEqual({
            asset: {
                kind: 'acao',
                ticker: 'NOVA3',
                name: 'Nova ON',
                company_name: 'Nova S.A.',
                cnpj: '44555666000177',
                sector: 'Mineração',
                outstanding_shares: 200_000_000,
                base_growth_pct: 6.5,
                quality_multiplier: 1,
            },
        })
    })

    it.each([
        ['ticker', { ticker: 'NOVA11' }],
        ['cnpj', { cnpj: '123' }],
        ['outstanding_shares', { outstanding_shares: '10' }],
        ['outstanding_shares', { outstanding_shares: '1,5' }],
        ['base_growth_pct', { base_growth_pct: '-100' }],
        ['quality_multiplier', { quality_multiplier: '3' }],
        ['name', { name: '  ' }],
    ] as const)('ação com %s inválido não gera pedido', (field, overrides) => {
        const result = buildNewAsset('acao', { ...equity, ...overrides })
        expect('errors' in result && result.errors[field]).toBeTruthy()
    })

    it('FII de tijolo e de papel', () => {
        expect(buildNewAsset('fii_tijolo', draft({ ticker: 'novo11', name: 'F', segment: 'Lajes', vacancy_rate: '4,5' }))).toEqual({
            asset: { kind: 'fii_tijolo', ticker: 'NOVO11', name: 'F', segment: 'Lajes', vacancy_rate: 4.5 },
        })
        expect(buildNewAsset('fii_papel', draft({ ticker: 'NOVP11', name: 'F', indexador: 'IPCA+' }))).toEqual({
            asset: { kind: 'fii_papel', ticker: 'NOVP11', name: 'F', indexador: 'IPCA+' },
        })
        expect('errors' in buildNewAsset('fii_tijolo', draft({ ticker: 'NOVO11', name: 'F', segment: '' }))).toBe(true)
        expect('errors' in buildNewAsset('fii_papel', draft({ ticker: 'NOVP3', name: 'F' }))).toBe(true)
    })

    it('ETF: cesta com pesos que somam 100, sem metodologia vazia', () => {
        const etf = draft({
            ticker: 'NOVE11',
            name: 'ETF',
            benchmark_index: 'Idx',
            holdings: [
                { ticker: 'valr3', weight_pct: '60' },
                { ticker: 'TJLO11', weight_pct: '40' },
            ],
        })
        expect(buildNewAsset('etf', etf)).toEqual({
            asset: {
                kind: 'etf',
                ticker: 'NOVE11',
                name: 'ETF',
                benchmark_index: 'Idx',
                holdings: [
                    { ticker: 'VALR3', weight_pct: 60 },
                    { ticker: 'TJLO11', weight_pct: 40 },
                ],
            },
        })
        const bad = (holdings: NewAssetDraft['holdings']) => {
            const result = buildNewAsset('etf', { ...etf, holdings })
            return 'errors' in result ? result.errors.holdings : undefined
        }
        expect(bad([{ ticker: 'VALR3', weight_pct: '60' }])).toContain('somar 100')
        expect(bad([{ ticker: '', weight_pct: '100' }])).toContain('Linha 1')
        expect(
            bad([
                { ticker: 'A', weight_pct: '50' },
                { ticker: 'a', weight_pct: '50' },
            ]),
        ).toContain('duas vezes')
    })

    it('soma os pesos digitados', () => {
        expect(
            holdingsTotal([
                { ticker: 'A', weight_pct: '60,5' },
                { ticker: 'B', weight_pct: 'x' },
            ]),
        ).toBe(60.5)
    })
})

describe('describeNewAssetError', () => {
    it('422 traz a mensagem e o campo do motor; 409 aponta o ticker', () => {
        expect(describeNewAssetError(new ApiError(422, 'CNPJ deve ter 14 dígitos', { error: 'x', field: 'cnpj' }))).toEqual({
            message: 'CNPJ deve ter 14 dígitos',
            field: 'cnpj',
        })
        expect(describeNewAssetError(new ApiError(409, 'o ticker NOVA3 já existe'))).toEqual({
            message: 'o ticker NOVA3 já existe',
            field: 'ticker',
        })
    })

    it('500 com asset_id avisa que o ativo foi criado', () => {
        const failure = describeNewAssetError(new ApiError(500, 'cobertura falhou', { error: 'cobertura falhou', asset_id: 'a1' }))
        expect(failure.assetId).toBe('a1')
        expect(failure.message).toContain('O ativo foi criado')
    })

    it('erro desconhecido manda conferir a auditoria', () => {
        expect(describeNewAssetError(new Error('boom')).message).toContain('auditoria')
    })
})
