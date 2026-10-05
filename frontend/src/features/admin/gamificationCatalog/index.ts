import { ApiError } from '../../../services/client'
import type { AchievementCriterionOption, AdminRankingCriterion, AdminRankingWindow, MissionVerification } from '../../../services/admin'
import { formatCurrency } from '../../portfolio/format'
import { parseCreditAmount } from '../adminUsers'

export const MAX_ACHIEVEMENT_NAME_LENGTH = 100
export const MAX_ACHIEVEMENT_DESCRIPTION_LENGTH = 255
export const MAX_MISSION_TITLE_LENGTH = 150
export const MAX_MISSION_DESCRIPTION_LENGTH = 500
export const MIN_MISSION_XP_REWARD = 1
export const MAX_MISSION_XP_REWARD = 500

export const RANKING_WINDOW_LABELS: Record<AdminRankingWindow, string> = {
    week: 'Semana',
    month: 'Mês',
}

export const RANKING_CRITERION_LABELS: Record<AdminRankingCriterion, string> = {
    overall: 'Rentabilidade geral',
    fixedIncome: 'Renda fixa',
    variableIncome: 'Renda variável',
    level: 'Nível',
}

// Como a conclusão da missão é conferida. É código, não dado: por isso o painel não cria missão nova
// nem edita o tipo.
export const MISSION_VERIFICATION_LABELS: Record<MissionVerification, string> = {
    lesson_completion: 'Concluir uma lição',
    server_check: 'Conferida pelo servidor',
    client_reported: 'Reportada pelo app',
}

// Meta digitada → número. Contagem: inteiro positivo. Reais: aceita vírgula decimal e ponto de milhar.
export function parseCriteriaValue(raw: string, kind: AchievementCriterionOption['value_kind']): number | null {
    if (kind === 'currency') return parseCreditAmount(raw)
    const text = raw.trim()
    if (!/^\d+$/.test(text)) return null
    const value = Number(text)
    return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function formatCriteriaValue(value: number, kind: AchievementCriterionOption['value_kind']): string {
    return kind === 'currency' ? formatCurrency(value) : new Intl.NumberFormat('pt-BR').format(value)
}

// Texto do campo de meta ao editar (sem separador de milhar, pra reaparecer como foi digitado).
export function criteriaValueToInput(value: number): string {
    return String(value).replace('.', ',')
}

// XP da missão digitado → inteiro dentro da faixa, ou `null`.
export function parseMissionXp(raw: string): number | null {
    const text = raw.trim()
    if (!/^\d+$/.test(text)) return null
    const value = Number(text)
    return value >= MIN_MISSION_XP_REWARD && value <= MAX_MISSION_XP_REWARD ? value : null
}

const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
const utcDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

// Rentabilidade do ranking já vem em pontos percentuais (12,5 = 12,5%). `null` (critério de nível, que não
// tem rentabilidade) vira o traço de placeholder de dado, que a regra de UI isenta.
export function formatRankingPct(value: number | null): string {
    return value === null ? '—' : `${percentFormatter.format(value)}%`
}

// Período da janela corrente, em UTC (o ranking é calculado em UTC): "05/10/2026 a 11/10/2026".
export function formatWindowRange(startIso: string | null, endIso: string | null): string | null {
    if (!startIso || !endIso) return null
    return `${utcDateFormatter.format(new Date(startIso))} a ${utcDateFormatter.format(new Date(endIso))}`
}

// Erro do catálogo → texto pro admin. As mensagens de 404, 409 e 422 vêm do backend em português.
export function describeCatalogError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 400) return 'Dados inválidos. Confira os campos preenchidos.'
        if (err.status === 404 || err.status === 409 || err.status === 422) return err.message
    }
    return 'Não foi possível concluir a ação agora. Tente novamente em instantes.'
}
