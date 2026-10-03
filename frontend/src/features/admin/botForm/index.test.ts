import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { defaultBotFormValues, describeBotError, parseNumber, toCreateInput, validateBotForm } from '.'

const valid = () => ({ ...defaultBotFormValues('chartista'), sectors: ['Varejo'] })

describe('botForm', () => {
    it('aceita vírgula ou ponto como separador decimal', () => {
        expect(parseNumber('12,5')).toBe(12.5)
        expect(parseNumber(' 12.5 ')).toBe(12.5)
        expect(parseNumber('')).toBeNaN()
        expect(parseNumber('abc')).toBeNaN()
    })

    it('o valor padrão com um setor escolhido é válido', () => {
        expect(validateBotForm(valid())).toEqual({})
    })

    it('exige pelo menos um item de escopo', () => {
        expect(validateBotForm(defaultBotFormValues()).sectors).toMatch(/pelo menos um setor/)
        expect(validateBotForm({ ...defaultBotFormValues(), assetClasses: ['fii'] }).sectors).toBeUndefined()
    })

    it.each([
        ['withinScopePct', '84.9'],
        ['withinScopePct', '90.1'],
        ['maxPositionSizePct', '0'],
        ['maxPositionSizePct', '101'],
        ['marketOrderPreferencePct', '-1'],
        ['spreadWidthPct', '10.5'],
        ['initialCash', '0'],
        ['initialCash', '1000000000001'],
        ['initialCash', ''],
    ] as const)('recusa %s = %s', (field, value) => {
        expect(validateBotForm({ ...valid(), [field]: value })[field]).toBeTruthy()
    })

    it('conhecimento só é validado no Fundamentalista e teto só no Market Maker', () => {
        expect(validateBotForm({ ...valid(), knowledgeLevelPct: '500', maxCoveredAssets: 'x' })).toEqual({})
        const fundamentalist = { ...defaultBotFormValues('fundamentalista'), sectors: ['Varejo'] }
        expect(validateBotForm({ ...fundamentalist, knowledgeLevelPct: '101' }).knowledgeLevelPct).toBeTruthy()
        const maker = { ...defaultBotFormValues('market_maker'), sectors: ['Varejo'] }
        expect(validateBotForm({ ...maker, maxCoveredAssets: '' })).toEqual({})
        expect(validateBotForm({ ...maker, maxCoveredAssets: '2.5' }).maxCoveredAssets).toBeTruthy()
        expect(validateBotForm({ ...maker, maxCoveredAssets: '0' }).maxCoveredAssets).toBeTruthy()
    })

    it('converte porcentagem em fração sem ruído de ponto flutuante', () => {
        const input = toCreateInput({ ...valid(), withinScopePct: '87,5', maxPositionSizePct: '30', initialCash: '2500000' })
        expect(input).toMatchObject({
            archetype: 'chartista',
            sectors: ['Varejo'],
            risk_classes: [],
            asset_classes: [],
            within_scope_pct: 0.875,
            max_position_size_pct: 0.3,
            market_order_preference: 0.5,
            spread_width_pct: 0,
            initial_cash: 2500000,
        })
        expect(toCreateInput({ ...valid(), withinScopePct: '90' }).within_scope_pct).toBe(0.9)
    })

    it('só manda conhecimento no Fundamentalista e teto no Market Maker', () => {
        expect(toCreateInput(valid())).not.toHaveProperty('knowledge_level')
        expect(toCreateInput(valid())).not.toHaveProperty('max_covered_assets')

        const fundamentalist = { ...defaultBotFormValues('fundamentalista'), sectors: ['Varejo'], knowledgeLevelPct: '65' }
        expect(toCreateInput(fundamentalist).knowledge_level).toBe(0.65)

        const maker = { ...defaultBotFormValues('market_maker'), sectors: ['Varejo'], maxCoveredAssets: '4' }
        expect(toCreateInput(maker)).toMatchObject({ max_covered_assets: 4, spread_width_pct: 0.02, max_position_size_pct: 0.5 })
        expect(toCreateInput({ ...maker, maxCoveredAssets: '' })).not.toHaveProperty('max_covered_assets')
    })

    it('mensagens de erro por status do motor', () => {
        expect(describeBotError(new ApiError(400, 'largura de spread acima do teto'))).toContain('largura de spread acima do teto')
        expect(describeBotError(new ApiError(404, 'x'))).toMatch(/não existe mais/)
        expect(describeBotError(new ApiError(409, 'x'))).toMatch(/outro Market Maker/)
        expect(describeBotError(new ApiError(422, 'x', { matched: 600, max: 500 }))).toMatch(/600 ordens.*500/)
        expect(describeBotError(new Error('rede'))).toMatch(/Não foi possível concluir/)
    })
})
