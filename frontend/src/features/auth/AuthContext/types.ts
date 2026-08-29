import type { AuthUser } from '../../../services/auth'

export interface AuthContextValue {
    token: string | null
    user: AuthUser | null
    isLoading: boolean
    // `user` opcional: login/cadastro por e-mail (Login.tsx) já recebem o
    // usuário completo na resposta de `POST /auth/login`/`register` e podem
    // passá-lo direto, evitando um `GET /auth/me` redundante logo em seguida.
    // O callback do Google (AuthCallback.tsx) só tem o token no fragmento da
    // URL, então chama sem o segundo argumento e cai no fluxo de busca abaixo.
    login(token: string, user?: AuthUser): void
    logout(): void
    // Aplica um usuário já atualizado (ex: resposta de `PATCH /me`, tela 1.2/
    // 6.2) sem precisar refazer `GET /auth/me` — a mutação já devolve o
    // usuário inteiro.
    setUser(user: AuthUser): void
}
