export interface ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    token?: string | null
    // 401 que não significa "sessão acabou" (ex: senha errada na reautenticação):
    // não dispara o handler global de logout.
    keepSessionOn401?: boolean
}

export interface ErrorBody {
    error?: string
    details?: unknown
}

export type UnauthorizedHandler = () => void
