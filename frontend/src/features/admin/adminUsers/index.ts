import { ApiError } from '../../../services/client'
import type { AdminUserStatus } from '../../../services/admin'
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
