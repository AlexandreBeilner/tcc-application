// Cliente HTTP fino pro gateway (CLAUDE.md, spec seção 3 — porta de
// entrada única do backend). Em dev, `VITE_GATEWAY_URL` fica indefinida de
// propósito: o caminho relativo cai no proxy do Vite (vite.config.ts,
// tarefa 6.0.1), same-origin. Em produção (vite build, fora do dev server)
// é obrigatório configurar `VITE_GATEWAY_URL` com a URL absoluta do
// gateway — o CORS do backend (tarefa 6.0.1) é quem viabiliza essa chamada
// cross-origin.
export const API_BASE_URL = import.meta.env.VITE_GATEWAY_URL ?? ''

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
type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
}

interface ErrorBody {
  error?: string
  details?: unknown
}

// Todo módulo documentado em `.docs/backend/<módulo>.md` devolve erro 4xx
// como `{ error: string, details?: ... }` (conferido em auth.md) — este é
// o único lugar que sabe interpretar esse formato.
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const data: unknown = await res.json().catch(() => undefined)

  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.()
    }
    const errorBody = data as ErrorBody | undefined
    throw new ApiError(res.status, errorBody?.error ?? 'erro inesperado', errorBody?.details)
  }

  return data as T
}
