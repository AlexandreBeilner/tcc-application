import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import {
    criteriaValueToInput,
    describeCatalogError,
    formatCriteriaValue,
    formatRankingPct,
    formatWindowRange,
    parseCriteriaValue,
    parseMissionXp,
} from '.'

describe('gamificationCatalog', () => {
    it.each([
        ['7', 'integer', 7],
        ['  30  ', 'integer', 30],
        ['1.500,50', 'currency', 1500.5],
        ['12000', 'currency', 12000],
        ['12000.5', 'currency', 12000.5],
    ] as const)('interpreta a meta "%s" (%s) como %s', (raw, kind, expected) => {
        expect(parseCriteriaValue(raw, kind)).toBe(expected)
    })

    it.each([
        ['', 'integer'],
        ['0', 'integer'],
        ['7,5', 'integer'],
        ['7.5', 'integer'],
        ['-3', 'integer'],
        ['dez', 'integer'],
        ['99999999999999999999', 'integer'],
        ['0', 'currency'],
        ['-5', 'currency'],
        ['abc', 'currency'],
    ] as const)('recusa a meta "%s" (%s)', (raw, kind) => {
        expect(parseCriteriaValue(raw, kind)).toBeNull()
    })

    it('formata a meta: reais com moeda, contagem com milhar', () => {
        expect(formatCriteriaValue(12000, 'currency')).toMatch(/R\$\s?12\.000,00/)
        expect(formatCriteriaValue(1500, 'integer')).toBe('1.500')
    })

    it('devolve a meta pro campo de edição com vírgula decimal', () => {
        expect(criteriaValueToInput(7)).toBe('7')
        expect(criteriaValueToInput(12000.5)).toBe('12000,5')
    })

    it.each([
        ['1', 1],
        ['500', 500],
        [' 45 ', 45],
    ])('XP de missão "%s" vale %s', (raw, expected) => {
        expect(parseMissionXp(raw)).toBe(expected)
    })

    it.each(['0', '501', '1,5', '-3', '', 'muito', '1e2'])('recusa o XP de missão "%s"', (raw) => {
        expect(parseMissionXp(raw)).toBeNull()
    })

    it('formata a rentabilidade do ranking com sinal, e o traço quando não há (nível)', () => {
        expect(formatRankingPct(12.5)).toBe('+12,50%')
        expect(formatRankingPct(-1.2)).toBe('-1,20%')
        expect(formatRankingPct(0)).toBe('0,00%')
        expect(formatRankingPct(null)).toBe('—')
    })

    it('formata o período da janela em UTC, e nada quando não há janela', () => {
        expect(formatWindowRange('2026-10-05T00:00:00.000Z', '2026-10-11T23:59:59.999Z')).toBe('05/10/2026 a 11/10/2026')
        expect(formatWindowRange(null, null)).toBeNull()
    })

    it('traduz os erros do catálogo repassando a mensagem do backend em 404, 409 e 422', () => {
        expect(describeCatalogError(new ApiError(409, 'já existe uma conquista com esse nome'))).toBe(
            'já existe uma conquista com esse nome',
        )
        expect(describeCatalogError(new ApiError(422, 'o XP precisa ser um inteiro de 1 a 500'))).toBe(
            'o XP precisa ser um inteiro de 1 a 500',
        )
        expect(describeCatalogError(new ApiError(404, 'missão não encontrada'))).toBe('missão não encontrada')
        expect(describeCatalogError(new ApiError(400, 'x'))).toMatch(/Dados inválidos/)
        expect(describeCatalogError(new Error('rede'))).toMatch(/Não foi possível concluir/)
    })
})
