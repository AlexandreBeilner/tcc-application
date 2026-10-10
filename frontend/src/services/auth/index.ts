import { API_BASE_URL, apiRequest } from '../client'
import type {
    AccountExport,
    AuthResult,
    ChangePasswordInput,
    Identity,
    LoginInput,
    RegisterInput,
    ResetPasswordInput,
    AuthUser,
    UpdateProfileInput,
} from './types'

export type {
    AuthUser,
    AuthResult,
    RegisterInput,
    LoginInput,
    ResetPasswordInput,
    UpdateProfileInput,
    ChangePasswordInput,
    Identity,
    AccountExport,
} from './types'

export function register(input: RegisterInput): Promise<AuthResult> {
    return apiRequest<AuthResult>('/auth/register', { method: 'POST', body: input })
}

export function login(input: LoginInput): Promise<AuthResult> {
    return apiRequest<AuthResult>('/auth/login', { method: 'POST', body: input })
}

// Recuperação de senha (EM.2.2/EM.2.3). O backend responde 202 sempre igual, exista a conta ou
// não: a tela nunca descobre (nem mostra) se o e-mail tem conta.
export function requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } })
}

// `token` vem do fragmento do link do e-mail. 401 = link desconhecido, 410 = expirado ou já usado.
export function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', body: input })
}

// N.22: confere a senha de quem já está logado e devolve um token novo com a
// senha recém-conferida. 401 aqui é senha errada, não sessão inválida.
export function reauthenticate(token: string, password: string): Promise<{ token: string }> {
    return apiRequest<{ token: string }>('/auth/reauth', { method: 'POST', token, body: { password }, keepSessionOn401: true })
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

// Tela 9.2 (tarefa 6.10) — `accountRouter.ts`, mesmo módulo `auth`
// (`.docs/backend/auth.md`, seção "Configurações de conta e LGPD").
export function updateProfile(token: string, input: UpdateProfileInput): Promise<{ user: AuthUser }> {
    return apiRequest<{ user: AuthUser }>('/me', { method: 'PATCH', body: input, token })
}

export function changePassword(token: string, input: ChangePasswordInput): Promise<{ status: string }> {
    return apiRequest<{ status: string }>('/me/password', { method: 'POST', body: input, token })
}

// Tela 9.2 (tarefa 6.10.8) — `multipart/form-data`, campo `avatar`; ver
// `services/client` (`apiRequest` reconhece `FormData` e não faz
// `JSON.stringify`). Mesmo formato de resposta de `PATCH /me`.
export function uploadAvatar(token: string, file: File): Promise<{ user: AuthUser }> {
    const body = new FormData()
    body.append('avatar', file)
    return apiRequest<{ user: AuthUser }>('/me/avatar', { method: 'POST', body, token })
}

export function listIdentities(token: string): Promise<{ identities: Identity[] }> {
    return apiRequest<{ identities: Identity[] }>('/me/identities', { token })
}

// Tela 9.3 — portabilidade (RNF04). Devolve o payload cru; quem chama
// decide como virar arquivo (a página, não o serviço — client HTTP não
// deveria conhecer DOM/Blob).
export function exportAccountData(token: string): Promise<{ export: AccountExport }> {
    return apiRequest<{ export: AccountExport }>('/me/export', { token })
}

// `204` sem corpo — nunca `DELETE` físico no backend (anonimização,
// `.docs/backend/auth.md`), mas do ponto de vista do client é só "a sessão
// não serve mais", por isso quem chama sempre desloga em seguida.
export function deleteAccount(token: string): Promise<void> {
    return apiRequest<void>('/me', { method: 'DELETE', token })
}
