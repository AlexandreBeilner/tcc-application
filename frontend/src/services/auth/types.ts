export interface AuthUser {
    id: string
    name: string
    email: string
    username: string
    role: 'user' | 'admin'
    onboardingCompleted: boolean
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

// Tela 9.2 (tarefa 6.10) — `PATCH /me`, mesmas 3 regras de formato do
// cadastro, todas opcionais no backend mas sempre enviadas juntas aqui (o
// form de Configurações não faz edição parcial de campo único).
export interface UpdateProfileInput {
    name: string
    email: string
    username: string
}

// `POST /me/password` — `currentPassword` ausente é válido pra conta
// só-OAuth (`.docs/backend/auth.md`); o form não sabe distinguir esse caso
// de antemão, só reage ao 403 se o backend exigir e não vier preenchido
// (403, não 401 — ver `.docs/backend/auth.md`, achado da tarefa 6.10: um
// 401 aqui deslogaria a sessão via `services/client`).
export interface ChangePasswordInput {
    currentPassword?: string
    newPassword: string
}

// `GET /me/identities` — nunca inclui tokens (blindagem estrutural no
// repositório, `.docs/backend/auth.md`).
export interface Identity {
    id: string
    userId: string
    providerName: string
    providerAccountId: string
}

// `GET /me/export` — payload agregado de portabilidade (RNF04); o
// frontend só precisa serializar isto num arquivo, nunca inspecionar
// campos específicos, então fica solto em vez de espelhar cada tabela.
export type AccountExport = Record<string, unknown>
