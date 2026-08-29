export interface ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    token?: string | null
}

export interface ErrorBody {
    error?: string
    details?: unknown
}

export type UnauthorizedHandler = () => void
