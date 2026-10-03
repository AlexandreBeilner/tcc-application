import type { ApiRequestOptions, ErrorBody, UnauthorizedHandler } from './types'

// Cliente HTTP fino pro gateway (CLAUDE.md, spec seção 3 — porta de
// entrada única do backend). Em dev, `VITE_GATEWAY_URL` fica indefinida de
// propósito: o caminho relativo cai no proxy do Vite (vite.config.ts,
// tarefa 6.0.1), same-origin. Em produção (vite build, fora do dev server)
// é obrigatório configurar `VITE_GATEWAY_URL` com a URL absoluta do
// gateway — o CORS do backend (tarefa 6.0.1) é quem viabiliza essa chamada
// cross-origin.
export const API_BASE_URL = import.meta.env.VITE_GATEWAY_URL ?? ''

// Caminhos relativos devolvidos pelo backend (ex: `avatarUrl` = `/avatars/
// xxx.jpg`, tarefa 6.10.8) apontam pro gateway, não pro próprio frontend.
// Em dev isso passa despercebido porque o proxy do Vite (vite.config.ts)
// deixa a chamada same-origin; no build de produção (frontend nunca
// containerizado, CLAUDE.md) esse proxy não existe, então um `<img src=
// "/avatars/...">` cru resolveria contra a origem do frontend em vez do
// gateway. Mesmo raciocínio de `API_BASE_URL` acima — usar em qualquer
// lugar que renderiza um caminho relativo vindo da API como `src`/`href`.
export function resolveMediaUrl(path: string | null): string | null {
    return path ? `${API_BASE_URL}${path}` : null
}

// Código que o backend devolve em `401 { error }` quando uma ação destrutiva do
// painel exige senha conferida há pouco (N.22). Não é sessão inválida: quem
// trata é `AdminReauthProvider`, que pede a senha e repete a ação.
export const REAUTH_REQUIRED = 'reauth_required'

export class ApiError extends Error {
    readonly status: number
    readonly details?: unknown

    constructor(status: number, message: string, details?: unknown) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.details = details
    }
}

// Ponto único de reação a 401 (token ausente/expirado/inválido, qualquer
// endpoint) — critério de aceite da tarefa 6.0.2: tratado aqui, nunca
// repetido em cada tela. `AuthContext` registra o handler real (logout +
// redirecionamento); sem provider montado (ex: em teste isolado de outro
// módulo), a ausência de handler é inofensiva.
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
    onUnauthorized = handler
}

// Todo módulo documentado em `.docs/backend/<módulo>.md` devolve erro 4xx
// como `{ error: string, details?: ... }` (conferido em auth.md) — este é
// o único lugar que sabe interpretar esse formato.
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    // `FormData` (tarefa 6.10.8, `POST /me/avatar`) vai crua no `fetch` —
    // nunca `JSON.stringify` nem `Content-Type` manual, o browser monta o
    // boundary de `multipart/form-data` sozinho quando o header não é setado.
    const isFormData = options.body instanceof FormData
    if (options.body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json'
    }
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (res.status === 204) {
        return undefined as T
    }

    const data: unknown = await res.json().catch(() => undefined)

    if (!res.ok) {
        // `options.token` distingue um 401 de sessão (token expirado/inválido
        // num endpoint autenticado) de um 401 anônimo (ex: `POST /auth/login`
        // com senha errada) — sem essa checagem, um usuário já logado que erra
        // a senha numa segunda conta em `/login` derrubava a própria sessão
        // válida, já que esse handler é global (linha 22 acima).
        const errorBody = data as ErrorBody | undefined
        if (res.status === 401 && options.token && !options.keepSessionOn401 && errorBody?.error !== REAUTH_REQUIRED) {
            onUnauthorized?.()
        }
        // Convenção padrão (`.docs/backend/*.md`, ex: erro de validação Zod
        // em qualquer módulo): `details` = `errorBody.details`. Alguns
        // endpoints fogem dessa convenção e devolvem campos extras no nível
        // raiz em vez de aninhados em `details` (ex: `ProductLockedError` de
        // `POST /market/orders`, `{ error, key, unlockingLesson }`,
        // `.docs/backend/market.md`, tarefa J.3) — nesse caso, sem `details`
        // próprio, cai pro corpo bruto. Quem chama sabe o shape esperado do
        // próprio módulo e faz o narrowing, este cliente não precisa conhecer
        // cada formato.
        throw new ApiError(res.status, errorBody?.error ?? 'erro inesperado', errorBody?.details ?? data)
    }

    return data as T
}
