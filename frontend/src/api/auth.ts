import { API_BASE_URL, apiRequest } from './client'

// Mapeamento 1:1 com `.docs/backend/auth.md` — uma função por endpoint
// documentado, não um cliente genérico (tarefa 6.0.2).
export interface AuthUser {
  id: string
  name: string
  email: string
  username: string
  role: 'user' | 'admin'
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export interface RegisterInput {
  name: string
  email: string
  username: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export function register(input: RegisterInput): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/register', { method: 'POST', body: input })
}

export function login(input: LoginInput): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', { method: 'POST', body: input })
}

export function getCurrentUser(token: string): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/auth/me', { token })
}

// Sem caso de uso próprio no backend (delegação pura pro Google) — aqui
// também não é uma chamada `fetch`, é a URL de um redirecionamento de
// navegador inteiro (`<a href={googleLoginUrl()}>`), tela 1.1 (tarefa 6.2).
export function googleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google`
}
