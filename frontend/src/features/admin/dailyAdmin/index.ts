import { ApiError } from '../../../services/client'
import type {
    DailyMetricsDay,
    DailyAlertCode,
    DailyCardOrigin,
    DailyLearnMore,
    DailyScope,
    DailyStatus,
    DailyTally,
} from '../../../services/admin'

// Categorias do conteúdo do Diário (lista fechada do backend, `content/categories.ts`).
export const DAILY_CATEGORY_LABELS: Record<string, string> = {
    'planos-e-moeda': 'Planos e moeda',
    'juros-e-inflacao': 'Juros e inflação',
    instituicoes: 'Instituições',
    'crises-e-choques': 'Crises e choques',
    'produtos-e-regras': 'Produtos e regras',
    'bolsa-e-acoes': 'Bolsa e ações',
    'risco-e-analise': 'Risco e análise',
    'economia-geral': 'Economia geral',
    'politica-fiscal': 'Política fiscal',
    'cambio-e-setor-externo': 'Câmbio e setor externo',
    'eventos-globais': 'Eventos globais',
    'commodities-e-setores': 'Commodities e setores',
}

export const DAILY_CATEGORY_OPTIONS = Object.entries(DAILY_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

export function categoryLabel(category: string): string {
    return DAILY_CATEGORY_LABELS[category] ?? category
}

export const DAILY_SCOPE_LABELS: Record<DailyScope, string> = {
    brasil: 'Brasil',
    fora: 'Fora, com efeito no Brasil',
}

export const DAILY_SCOPE_OPTIONS = [
    { value: 'brasil', label: DAILY_SCOPE_LABELS.brasil },
    { value: 'fora', label: DAILY_SCOPE_LABELS.fora },
]

export const DAILY_LEARN_MORE_OPTIONS = [
    { value: '', label: 'Sem ligação' },
    { value: 'glossary', label: 'Termo do glossário' },
    { value: 'lesson', label: 'Lição' },
    { value: 'guide', label: 'Guia' },
]

export const DAILY_STATUS_LABELS: Record<DailyStatus, string> = {
    off: 'Desligado',
    scheduled: 'Estreia agendada',
    live: 'No ar',
}

export const DAILY_ORIGIN_LABELS: Record<DailyCardOrigin, string> = {
    generated: 'Gerado',
    manual: 'Trocado à mão',
}

export const DAILY_ALERT_MESSAGES: Record<DailyAlertCode, string> = {
    low_ready_cover: 'Menos de 14 dias prontos à frente. Crie mais conteúdo antes que ele acabe.',
    scheduled_below_minimum: 'A estreia está agendada, mas há menos de 30 dias seguidos de jogos prontos a partir dela.',
    today_not_published: 'O jogo de hoje não está publicado. Quem abrir o Diário vê o jogo como indisponível.',
}

// 'AAAA-MM-DD' -> 'DD/MM/AAAA', sem passar por Date (nenhum fuso entra na conta).
export function formatGameDate(date: string): string {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
}

export function tallyShare(tally: DailyTally, key: 'brasil' | 'fora'): string {
    return tally.total === 0 ? '0%' : `${Math.round((tally[key] / tally.total) * 100)}%`
}

export interface DailyErrorInfo {
    message: string
    code: string | null
    problems: string[]
}

function detailsOf(err: ApiError): { code?: string; problems?: string[] } {
    return typeof err.details === 'object' && err.details !== null ? (err.details as { code?: string; problems?: string[] }) : {}
}

// Mensagem para o admin a partir do erro da API: 409 e 422 trazem o motivo pronto em português.
export function describeDailyError(err: unknown): DailyErrorInfo {
    if (err instanceof ApiError) {
        const { code, problems } = detailsOf(err)
        if (err.status === 400) return { message: 'Dados inválidos. Confira os campos preenchidos.', code: null, problems: [] }
        if (err.status === 404 || err.status === 409 || err.status === 422) {
            return { message: err.message, code: code ?? null, problems: problems ?? [] }
        }
    }
    return { message: 'Não foi possível concluir a ação agora. Tente novamente em instantes.', code: null, problems: [] }
}

// 409 de jogo já publicado: a tela pede a confirmação explícita e repete a ação.
export function isConfirmationRequired(err: unknown): boolean {
    return err instanceof ApiError && err.status === 409 && detailsOf(err).code === 'confirmation_required'
}

export function formatNumbers(numbers: number[]): string {
    return numbers.map((n) => `#${n}`).join(', ')
}

// Campos que palavras, perguntas e eventos têm em comum no formulário: categoria, marcador Brasil/fora
// e a ligação opcional de "saiba mais".
export interface ItemCommon {
    category: string
    scope: DailyScope
    learnKind: '' | 'lesson' | 'glossary' | 'guide'
    learnRef: string
}

export const EMPTY_COMMON: ItemCommon = { category: DAILY_CATEGORY_OPTIONS[0].value, scope: 'brasil', learnKind: '', learnRef: '' }

export function commonOf(item: { category: string; scope: DailyScope; learn_more: DailyLearnMore | null }): ItemCommon {
    return { category: item.category, scope: item.scope, learnKind: item.learn_more?.kind ?? '', learnRef: item.learn_more?.ref ?? '' }
}

export function learnMoreOf(common: ItemCommon): DailyLearnMore | null {
    return common.learnKind === '' || common.learnRef.trim() === '' ? null : { kind: common.learnKind, ref: common.learnRef.trim() }
}

// Soma de cada coluna da medição do Diário (DI.7.1).
export function sumMetrics(days: DailyMetricsDay[]): Omit<DailyMetricsDay, 'date'> {
    const totals = { anon_started: 0, anon_completed: 0, logged_started: 0, logged_completed: 0, signups: 0, logins: 0 }
    for (const d of days) {
        totals.anon_started += d.anon_started
        totals.anon_completed += d.anon_completed
        totals.logged_started += d.logged_started
        totals.logged_completed += d.logged_completed
        totals.signups += d.signups
        totals.logins += d.logins
    }
    return totals
}
