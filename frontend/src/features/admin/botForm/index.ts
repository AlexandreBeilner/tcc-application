import { ApiError } from '../../../services/client'
import type { BotArchetype, CreateBotInput } from '../../../services/admin'
import type { BotFormErrors, BotFormValues } from './types'

export type { BotFormErrors, BotFormValues } from './types'

// Faixas do motor (bot.SpecializationWithinScopeMin/Max, MaxSpreadWidthPct, botadmin.MaxInitialCash).
// O motor valida de novo; aqui a tela recusa antes de chamar.
export const WITHIN_SCOPE_RANGE = { min: 85, max: 90 }
export const MAX_SPREAD_PCT = 10
export const MAX_INITIAL_CASH = 1_000_000_000_000

// Defaults por arquétipo. Spread só faz sentido pro Market Maker (os outros negociam a mercado
// ou limitada sem oferta de spread); conhecimento só existe no Fundamentalista.
export function defaultBotFormValues(archetype: BotArchetype = 'ruido'): BotFormValues {
    return {
        archetype,
        sectors: [],
        riskClasses: [],
        assetClasses: [],
        withinScopePct: '90',
        knowledgeLevelPct: '70',
        maxPositionSizePct: archetype === 'market_maker' ? '50' : '30',
        marketOrderPreferencePct: '50',
        spreadWidthPct: archetype === 'market_maker' ? '2' : '0',
        maxCoveredAssets: '',
        initialCash: '100000000',
    }
}

// "12,5" e "12.5" valem o mesmo número; vazio ou lixo viram NaN.
export function parseNumber(raw: string): number {
    const trimmed = raw.trim().replace(',', '.')
    return trimmed === '' ? NaN : Number(trimmed)
}

export function validateBotForm(values: BotFormValues): BotFormErrors {
    const errors: BotFormErrors = {}

    if (values.sectors.length + values.riskClasses.length + values.assetClasses.length === 0) {
        errors.sectors = 'Escolha pelo menos um setor, classe de risco ou classe de ativo.'
    }

    const within = parseNumber(values.withinScopePct)
    if (!(within >= WITHIN_SCOPE_RANGE.min && within <= WITHIN_SCOPE_RANGE.max)) {
        errors.withinScopePct = `Use um valor entre ${WITHIN_SCOPE_RANGE.min} e ${WITHIN_SCOPE_RANGE.max}.`
    }

    if (values.archetype === 'fundamentalista') {
        const knowledge = parseNumber(values.knowledgeLevelPct)
        if (!(knowledge >= 0 && knowledge <= 100)) errors.knowledgeLevelPct = 'Use um valor entre 0 e 100.'
    }

    const position = parseNumber(values.maxPositionSizePct)
    if (!(position > 0 && position <= 100)) errors.maxPositionSizePct = 'Use um valor maior que 0 e até 100.'

    const marketOrder = parseNumber(values.marketOrderPreferencePct)
    if (!(marketOrder >= 0 && marketOrder <= 100)) errors.marketOrderPreferencePct = 'Use um valor entre 0 e 100.'

    const spread = parseNumber(values.spreadWidthPct)
    if (!(spread >= 0 && spread <= MAX_SPREAD_PCT)) errors.spreadWidthPct = `Use um valor entre 0 e ${MAX_SPREAD_PCT}.`

    if (values.archetype === 'market_maker' && values.maxCoveredAssets.trim() !== '') {
        const max = parseNumber(values.maxCoveredAssets)
        if (!Number.isInteger(max) || max < 1) errors.maxCoveredAssets = 'Use um número inteiro maior que 0.'
    }

    const cash = parseNumber(values.initialCash)
    if (!(cash > 0 && cash <= MAX_INITIAL_CASH)) errors.initialCash = 'Informe um valor maior que 0, de até R$ 1 trilhão.'

    return errors
}

// Percentual digitado vira fração, sem o ruído de ponto flutuante (0,9 e não 0,9000000000000001).
export function toFraction(pct: string): number {
    return Math.round(parseNumber(pct) * 100) / 10000
}

// Só chamar com `validateBotForm` sem erros. Campos de outro arquétipo não vão no corpo: o
// motor recusa conhecimento fora do Fundamentalista e teto de cobertura fora do Market Maker.
export function toCreateInput(values: BotFormValues): CreateBotInput {
    const input: CreateBotInput = {
        archetype: values.archetype,
        sectors: values.sectors,
        risk_classes: values.riskClasses,
        asset_classes: values.assetClasses,
        within_scope_pct: toFraction(values.withinScopePct),
        max_position_size_pct: toFraction(values.maxPositionSizePct),
        market_order_preference: toFraction(values.marketOrderPreferencePct),
        spread_width_pct: toFraction(values.spreadWidthPct),
        initial_cash: parseNumber(values.initialCash),
    }
    if (values.archetype === 'fundamentalista') input.knowledge_level = toFraction(values.knowledgeLevelPct)
    if (values.archetype === 'market_maker' && values.maxCoveredAssets.trim() !== '') {
        input.max_covered_assets = parseNumber(values.maxCoveredAssets)
    }
    return input
}

// Mensagens fixas por situação conhecida; a recusa do motor (400) traz o motivo específico. O 409
// muda de sentido conforme a ação: na alteração é cobertura repetida, no aporte é o teto de float.
export function describeBotError(err: unknown, action: 'update' | 'fund' = 'update'): string {
    if (err instanceof ApiError) {
        if (err.status === 400) return `O motor recusou: ${err.message}`
        if (err.status === 404) return 'Esse bot não existe mais. A lista foi atualizada.'
        if (err.status === 409 && action === 'fund') {
            return 'A posição passaria do total de cotas em circulação do ativo: o float já está distribuído. Nada foi aportado. Aporte só caixa ou escolha um ativo com folga.'
        }
        if (err.status === 409) {
            return 'Esse ativo já é coberto por outro Market Maker (talvez um inativo). Tire-o de lá primeiro. A lista foi atualizada.'
        }
        if (err.status === 422) {
            const details = err.details as { matched?: number; max?: number } | undefined
            return `O Market Maker tem ${details?.matched ?? 'ordens demais'} ordens em repouso no ativo, acima do teto de ${details?.max ?? 500} por lote. Nada foi alterado: cancele parte delas na tela de ordens.`
        }
    }
    return 'Não foi possível concluir agora. Confira a lista e a auditoria antes de tentar de novo.'
}
