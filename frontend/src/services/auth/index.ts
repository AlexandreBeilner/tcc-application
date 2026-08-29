import { API_BASE_URL, apiRequest } from '../client'
import type { AuthResult, LoginInput, RegisterInput, AuthUser } from './types'

export type { AuthUser, AuthResult, RegisterInput, LoginInput } from './types'

export function register(input: RegisterInput): Promise<AuthResult> {
    return apiRequest<AuthResult>('/auth/register', { method: 'POST', body: input })
}

export function login(input: LoginInput): Promise<AuthResult> {
    return apiRequest<AuthResult>('/auth/login', { method: 'POST', body: input })
}

export function getCurrentUser(token: string): Promise<{ user: AuthUser }> {
    return apiRequest<{ user: AuthUser }>('/auth/me', { token })
}

// Onboarding (tela 1.2, tarefa 6.2): "Começar"/"pular" chamam isto, nunca
// um flag local — `.docs/backend/auth.md` (PATCH /me) já devolve o
// usuário atualizado, então `AuthContext.setUser` aplica o resultado
// direto, sem precisar de um novo `GET /auth/me`.
export function completeOnboarding(token: string): Promise<{ user: AuthUser }> {
    return apiRequest<{ user: AuthUser }>('/me', {
        method: 'PATCH',
        body: { onboardingCompleted: true },
        token,
    })
}

// Sem caso de uso próprio no backend (delegação pura pro Google) — aqui
// também não é uma chamada `fetch`, é a URL de um redirecionamento de
// navegador inteiro (`<a href={googleLoginUrl()}>`), tela 1.1 (tarefa 6.2).
export function googleLoginUrl(): string {
    return `${API_BASE_URL}/auth/google`
}
