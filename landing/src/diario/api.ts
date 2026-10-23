import { isRecord } from './dom.ts'
import type { DailyGame, DailyStats, GuessResponse, TodayResponse, TriviaResponse } from './types.ts'

/** Erro HTTP da API do Diário. `status` 0 = sem conexão. `code` é o `error` do corpo (`word_not_accepted`, `already_answered`...). */
export class DailyApiError extends Error {
    readonly status: number
    readonly code: string | null
    readonly body: unknown
    readonly retryAfter: number | null

    constructor(status: number, code: string | null, body: unknown, retryAfter: number | null) {
        super(`Diário: ${status}${code ? ` ${code}` : ''}`)
        this.name = 'DailyApiError'
        this.status = status
        this.code = code
        this.body = body
        this.retryAfter = retryAfter
    }
}

export interface DailyApi {
    today(): Promise<TodayResponse>
    game(number: number): Promise<DailyGame>
    guess(number: number, guess: string, attempt?: number): Promise<GuessResponse>
    trivia(number: number, choice: number): Promise<TriviaResponse>
    /** Só logado (modo `app`). */
    me(number: number): Promise<unknown>
    stats(): Promise<DailyStats>
}

export interface ApiOptions {
    baseUrl: string
    fetch?: typeof fetch
    /** Token do app; sem token a chamada é anônima (modo `publico`). */
    getToken?: () => string | null
}

export type MetricEvent = 'started' | 'completed' | 'signup' | 'login'

/**
 * Avisa o contador agregado do servidor (DI.7.1). Dispara e esquece: nunca lança, nunca bloqueia o
 * jogo, não manda identificador nem token (só o nome do evento).
 */
export function reportMetric(baseUrl: string, event: MetricEvent, fetchImpl?: typeof fetch): void {
    const doFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis)
    if (!doFetch) return
    try {
        void doFetch(`${baseUrl.replace(/\/$/, '')}/daily/metrics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event }),
            credentials: 'omit',
            keepalive: true,
        }).catch(() => undefined)
    } catch {
        // medir é secundário
    }
}

export function createDailyApi({ baseUrl, fetch: fetchImpl, getToken }: ApiOptions): DailyApi {
    const base = baseUrl.replace(/\/$/, '')

    async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
        const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis)
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (body !== undefined) headers['Content-Type'] = 'application/json'
        const token = getToken?.()
        if (token) headers.Authorization = `Bearer ${token}`
        let res: Response
        try {
            res = await doFetch(`${base}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                credentials: 'omit',
                cache: 'no-store',
            })
        } catch {
            throw new DailyApiError(0, 'network', null, null)
        }
        let data: unknown = null
        try {
            data = await res.json()
        } catch {
            data = null
        }
        if (!res.ok) {
            const retry = Number(res.headers.get('Retry-After'))
            throw new DailyApiError(
                res.status,
                isRecord(data) && typeof data.error === 'string' ? data.error : null,
                data,
                Number.isFinite(retry) && retry > 0 ? retry : null,
            )
        }
        return data as T
    }

    return {
        today: () => request('GET', '/daily/today'),
        game: (n) => request('GET', `/daily/${n}`),
        guess: (n, guess, attempt) => request('POST', `/daily/${n}/word/guess`, attempt === undefined ? { guess } : { guess, attempt }),
        trivia: (n, choice) => request('POST', `/daily/${n}/cards/trivia/answer`, { choice }),
        me: (n) => request('GET', `/daily/${n}/me`),
        stats: () => request('GET', '/daily/me/stats'),
    }
}
