import { describe, expect, it } from 'vitest'
import { describeArchetype, describeScope, formatPercent, shortBotId } from '.'

describe('botLabels', () => {
    it('traduz o arquétipo do motor e mantém o desconhecido como veio', () => {
        expect(describeArchetype('fundamentalista')).toBe('Fundamentalista')
        expect(describeArchetype('ruido')).toBe('Ruído')
        expect(describeArchetype('novo')).toBe('novo')
    })

    it('descreve o escopo com setores, risco, classes de ativo e a fatia da atividade', () => {
        expect(
            describeScope({
                sectors: ['Varejo', 'Energia'],
                risk_classes: ['Conservador'],
                asset_classes: ['fii', 'etf'],
                within_scope_pct: 0.875,
            }),
        ).toBe('Varejo, Energia, risco conservador, FIIs, ETFs, 87,5% da atividade')
    })

    it('formata fração como porcentagem sem casas inúteis', () => {
        expect(formatPercent(0.9)).toBe('90%')
        expect(formatPercent(0.02)).toBe('2%')
        expect(formatPercent(0)).toBe('0%')
    })

    it('encurta o id do bot', () => {
        expect(shortBotId('00000000-0000-0000-0001-000000000002')).toBe('000002')
    })
})
