import type { AdminBot, UpdateBotInput } from '../../../services/admin'
import { MAX_SPREAD_PCT, WITHIN_SCOPE_RANGE, parseNumber, toFraction } from '../botForm'
import type { BotEditErrors, BotEditValues } from './types'

export type { BotEditErrors, BotEditValues } from './types'

// Fração do motor (0,875) vira o texto que o admin digita ("87,5"), sem ruído de ponto flutuante.
function toPercentText(fraction: number): string {
    return String(Math.round(fraction * 10000) / 100).replace('.', ',')
}

export function editValuesFromBot(bot: AdminBot): BotEditValues {
    return {
        sectors: [...bot.scope.sectors],
        riskClasses: [...bot.scope.risk_classes],
        assetClasses: [...bot.scope.asset_classes],
        withinScopePct: toPercentText(bot.scope.within_scope_pct),
        knowledgeLevelPct: bot.knowledge_level === null ? '' : toPercentText(bot.knowledge_level),
        maxPositionSizePct: toPercentText(bot.risk_profile.max_position_size_pct),
        spreadWidthPct: toPercentText(bot.risk_profile.spread_width_pct),
    }
}

// Mesmas faixas da criação (o motor valida de novo). Conhecimento só existe no Fundamentalista.
export function validateBotEdit(values: BotEditValues, archetype: AdminBot['archetype']): BotEditErrors {
    const errors: BotEditErrors = {}

    if (values.sectors.length + values.riskClasses.length + values.assetClasses.length === 0) {
        errors.sectors = 'Escolha pelo menos um setor, classe de risco ou classe de ativo.'
    }

    const within = parseNumber(values.withinScopePct)
    if (!(within >= WITHIN_SCOPE_RANGE.min && within <= WITHIN_SCOPE_RANGE.max)) {
        errors.withinScopePct = `Use um valor entre ${WITHIN_SCOPE_RANGE.min} e ${WITHIN_SCOPE_RANGE.max}.`
    }

    if (archetype === 'fundamentalista') {
        const knowledge = parseNumber(values.knowledgeLevelPct)
        if (!(knowledge >= 0 && knowledge <= 100)) errors.knowledgeLevelPct = 'Use um valor entre 0 e 100.'
    }

    const position = parseNumber(values.maxPositionSizePct)
    if (!(position > 0 && position <= 100)) errors.maxPositionSizePct = 'Use um valor maior que 0 e até 100.'

    const spread = parseNumber(values.spreadWidthPct)
    if (!(spread >= 0 && spread <= MAX_SPREAD_PCT)) errors.spreadWidthPct = `Use um valor entre 0 e ${MAX_SPREAD_PCT}.`

    return errors
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item))

// Só os campos que mudaram, pra auditoria registrar exatamente o que foi alterado (e o PATCH
// vazio, sem mudança nenhuma, nem sair da tela). Só chamar com `validateBotEdit` sem erros.
export function toUpdateInput(values: BotEditValues, bot: AdminBot): UpdateBotInput {
    const input: UpdateBotInput = {}
    if (!sameSet(values.sectors, bot.scope.sectors)) input.sectors = values.sectors
    if (!sameSet(values.riskClasses, bot.scope.risk_classes)) input.risk_classes = values.riskClasses
    if (!sameSet(values.assetClasses, bot.scope.asset_classes)) input.asset_classes = values.assetClasses

    const within = toFraction(values.withinScopePct)
    if (within !== bot.scope.within_scope_pct) input.within_scope_pct = within
    const position = toFraction(values.maxPositionSizePct)
    if (position !== bot.risk_profile.max_position_size_pct) input.max_position_size_pct = position
    const spread = toFraction(values.spreadWidthPct)
    if (spread !== bot.risk_profile.spread_width_pct) input.spread_width_pct = spread
    if (bot.archetype === 'fundamentalista') {
        const knowledge = toFraction(values.knowledgeLevelPct)
        if (knowledge !== bot.knowledge_level) input.knowledge_level = knowledge
    }
    return input
}
