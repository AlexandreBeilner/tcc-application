// Decide se o token de uma sessão ainda vale, olhando o estado atual do
// usuário (N.16): o JWT é stateless, então suspensão e "forçar logout" só
// têm efeito se alguém consultar o banco a cada requisição autenticada.
export type SessionVerdict = 'ok' | 'suspended' | 'revoked'

export interface SessionGuard {
  check(userId: string, tokenVersion: number): Promise<SessionVerdict>
}
