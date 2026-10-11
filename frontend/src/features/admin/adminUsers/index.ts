import { ApiError } from '../../../services/client'
import type { AdminUserStatus, UserProStatus } from '../../../services/admin'
import { ReauthCancelledError } from '../AdminReauth'

export const STATUS_LABELS: Record<AdminUserStatus, string> = {
    active: 'Ativa',
    suspended: 'Suspensa',
}

export const ROLE_LABELS = { user: 'Usuário', admin: 'Administrador' } as const

const PROVIDER_LABELS: Record<string, string> = {
    password: 'E-mail e senha',
    google: 'Google',
}

export function describeProvider(provider: string): string {
    return PROVIDER_LABELS[provider] ?? provider
}

// Nome na lista quando a conta foi anonimizada (exclusão LGPD): o motivo fica claro.
export function isAnonymized(username: string): boolean {
    return username.startsWith('usuario-removido-')
}

export const MIN_SUSPEND_REASON_LENGTH = 3
export const MAX_SUSPEND_REASON_LENGTH = 500

// Erro do painel de usuários → texto pro admin. Cobre o 422 de conta protegida (admin),
// o 409 de estado e a janela de senha cancelada.
export function describeUserActionError(err: unknown): string {
    if (err instanceof ReauthCancelledError) return err.message
    if (err instanceof ApiError) {
        if (err.status === 404) return 'Usuário não encontrado.'
        if (err.status === 409)
            return err.message === 'a conta já está suspensa' ? 'A conta já está suspensa.' : 'A conta não está suspensa.'
        if (err.status === 422) {
            const code = (err.details as { code?: string } | undefined)?.code
            if (code === 'admin_account_protected') return 'Conta de administrador não pode ser suspensa nem excluída pelo painel.'
            if (code === 'confirmation_mismatch') return 'O username digitado não confere.'
        }
        if (err.status === 400) return 'Dados inválidos. Confira o motivo informado.'
    }
    return 'Não foi possível concluir a ação agora. Tente novamente em instantes.'
}

export const MIN_CORRECTION_REASON_LENGTH = 3
export const MAX_CORRECTION_REASON_LENGTH = 500

// Valor do crédito digitado → número. Aceita vírgula decimal e ponto de milhar
// ("1.234,56"), ou ponto decimal ("1234.56"). `null` quando não é um número positivo e finito.
export function parseCreditAmount(raw: string): number | null {
    const text = raw.trim().replace(/\s/g, '')
    if (text === '') return null
    const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null
    const value = Number(normalized)
    return Number.isFinite(value) && value > 0 ? value : null
}

// Inteiro digitado (aceita sinal) → número, ou `null`.
export function parseWholeNumber(raw: string): number | null {
    const text = raw.trim()
    if (!/^[+-]?\d+$/.test(text)) return null
    const value = Number(text)
    return Number.isSafeInteger(value) ? value : null
}

// Erro de uma correção manual (N.17) → texto pro admin. As mensagens de 404, 409 e 422 vêm
// do backend já em português e dizem exatamente o que aconteceu.
export function describeCorrectionError(err: unknown): string {
    if (err instanceof ReauthCancelledError) return err.message
    if (err instanceof ApiError) {
        if (err.status === 400) return 'Dados inválidos. Confira o valor e o motivo informados.'
        if (err.status === 404 || err.status === 409 || err.status === 422) return err.message
    }
    return 'Não foi possível concluir a ação agora. Tente novamente em instantes.'
}

// Teto de dias por concessão de PRO promocional (MO.2.5); o backend valida o mesmo limite.
export const MAX_PRO_GRANT_DAYS = 90

// Dias digitados → inteiro de 1 ao teto, ou `null`.
export function parseGrantDays(raw: string): number | null {
    const value = parseWholeNumber(raw)
    return value !== null && value >= 1 && value <= MAX_PRO_GRANT_DAYS ? value : null
}

const STORE_LABELS: Record<string, string> = {
    promotional: 'concessão promocional',
    stripe: 'cartão pela web',
    app_store: 'App Store',
    play_store: 'Google Play',
}

const PLAN_LABELS: Record<string, string> = { monthly: 'mensal', annual: 'anual' }

// Resumo do plano pro cartão "Plano atual".
export function planSummary(status: UserProStatus): string {
    if (!status.is_pro) return status.state === 'none' ? 'Sem plano PRO' : 'PRO inativo'
    const plan = status.plan ? PLAN_LABELS[status.plan] : null
    const store = status.store ? STORE_LABELS[status.store] : null
    const detail = [plan, store].filter(Boolean).join(', ')
    return detail ? `PRO ativo (${detail})` : 'PRO ativo'
}

// Erro da concessão de PRO → texto pro admin. 404, 409 e 422 vêm do backend em português.
export function describeProGrantError(err: unknown): string {
    if (err instanceof ReauthCancelledError) return err.message
    if (err instanceof ApiError) {
        if (err.status === 400) return 'Dados inválidos. Informe de 1 a 90 dias e um motivo de pelo menos 5 caracteres.'
        if (err.status === 404 || err.status === 409 || err.status === 422) return err.message
        if (err.status === 502) return 'O provedor de cobrança não respondeu. Nada foi concedido, tente de novo em instantes.'
        if (err.status === 503) return 'A cobrança está desligada neste ambiente, então não dá para conceder PRO.'
    }
    return 'Não foi possível conceder agora. Tente novamente em instantes.'
}
