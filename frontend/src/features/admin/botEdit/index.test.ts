import { describe, expect, it } from 'vitest'
import type { AdminBot } from '../../../services/admin'
import { editValuesFromBot, toUpdateInput, validateBotEdit } from '.'

const bot = (overrides: Partial<AdminBot> = {}): AdminBot => ({
    account_id: '00000000-0000-0000-0002-000000000001',
    archetype: 'fundamentalista',
    is_active: true,
    cash: 1000,
    scope: { sectors: ['Varejo'], risk_classes: ['Conservador'], asset_classes: [], within_scope_pct: 0.875 },
    knowledge_level: 0.6,
    risk_profile: { max_position_size_pct: 0.3, market_order_preference: 0.5, spread_width_pct: 0.02 },
    max_covered_assets: null,
    covered_assets: [],
    holdings: [],
    ...overrides,
})

describe('botEdit', () => {
    it('converte as frações do motor pro texto em porcentagem, com vírgula', () => {
        expect(editValuesFromBot(bot())).toEqual({
            sectors: ['Varejo'],
            riskClasses: ['Conservador'],
            assetClasses: [],
            withinScopePct: '87,5',
            knowledgeLevelPct: '60',
            maxPositionSizePct: '30',
            spreadWidthPct: '2',
        })
    })

    it('bot sem conhecimento deixa o campo vazio', () => {
        expect(editValuesFromBot(bot({ archetype: 'chartista', knowledge_level: null })).knowledgeLevelPct).toBe('')
    })

    it('os valores atuais do bot são válidos e não geram alteração', () => {
        const current = bot()
        const values = editValuesFromBot(current)
        expect(validateBotEdit(values, current.archetype)).toEqual({})
        expect(toUpdateInput(values, current)).toEqual({})
    })

    it('recusa fora das faixas do motor', () => {
        const values = {
            ...editValuesFromBot(bot()),
            sectors: [],
            riskClasses: [],
            withinScopePct: '50',
            knowledgeLevelPct: '150',
            maxPositionSizePct: '0',
            spreadWidthPct: '11',
        }
        const errors = validateBotEdit(values, 'fundamentalista')
        expect(Object.keys(errors).sort()).toEqual([
            'knowledgeLevelPct',
            'maxPositionSizePct',
            'sectors',
            'spreadWidthPct',
            'withinScopePct',
        ])
    })

    it('conhecimento só é validado no fundamentalista', () => {
        const values = { ...editValuesFromBot(bot()), knowledgeLevelPct: '' }
        expect(validateBotEdit(values, 'chartista')).toEqual({})
        expect(validateBotEdit(values, 'fundamentalista').knowledgeLevelPct).toBeDefined()
    })

    it('manda só o que mudou, em fração, sem ruído de ponto flutuante', () => {
        const current = bot()
        const values = {
            ...editValuesFromBot(current),
            sectors: ['Varejo', 'Energia'],
            withinScopePct: '88',
            spreadWidthPct: '3',
            knowledgeLevelPct: '70',
        }
        expect(toUpdateInput(values, current)).toEqual({
            sectors: ['Varejo', 'Energia'],
            within_scope_pct: 0.88,
            spread_width_pct: 0.03,
            knowledge_level: 0.7,
        })
    })

    it('trocar a ordem dos itens do escopo não conta como mudança', () => {
        const current = bot({ scope: { sectors: ['Varejo', 'Energia'], risk_classes: [], asset_classes: [], within_scope_pct: 0.9 } })
        const values = { ...editValuesFromBot(current), sectors: ['Energia', 'Varejo'] }
        expect(toUpdateInput(values, current)).toEqual({})
    })

    it('esvaziar uma lista é uma mudança (a lista vazia substitui a atual)', () => {
        const current = bot()
        const values = { ...editValuesFromBot(current), riskClasses: [] }
        expect(toUpdateInput(values, current)).toEqual({ risk_classes: [] })
    })

    it('nunca manda conhecimento de quem não é fundamentalista', () => {
        const current = bot({ archetype: 'chartista', knowledge_level: null })
        const values = { ...editValuesFromBot(current), knowledgeLevelPct: '90' }
        expect(toUpdateInput(values, current)).toEqual({})
    })
})
