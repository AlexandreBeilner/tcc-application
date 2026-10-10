import { ApiError } from '../../services/client'

// Ponto único de texto de erro de API para a UI (tarefa RC.1.5). O backend já
// devolve `error` em português para o usuário (proxy do engine traduz em
// `engineErrorTranslator`), mas a tela nunca confia cegamente: erro de servidor
// (5xx), erro que não é da API e mensagem com cara de texto interno (snake_case,
// código técnico) viram a mensagem de fallback da própria tela.
const LOOKS_INTERNAL = /[a-z]+_[a-z_]+|\b(?:undefined|null|NaN)\b|\bat\s+\S+\.(?:ts|js)\b/

export function formatApiError(err: unknown, fallback: string): string {
    if (!(err instanceof ApiError)) return fallback
    if (err.status >= 500) return fallback
    if (!err.message || LOOKS_INTERNAL.test(err.message)) return fallback
    return err.message
}

// `code` estável do erro (ex: 'insufficient_balance', 'market_closed'), quando o
// backend o envia. Telas decidem comportamento por `code`, nunca pelo texto.
export function apiErrorCode(err: unknown): string | null {
    if (!(err instanceof ApiError)) return null
    const code = (err.details as { code?: unknown } | undefined)?.code
    return typeof code === 'string' ? code : null
}
