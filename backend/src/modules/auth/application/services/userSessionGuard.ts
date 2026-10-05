import type { SessionGuard, SessionVerdict } from '../ports/sessionGuard'
import type { UserRepository } from '../ports/userRepository'

// Uma leitura por chave primária por requisição autenticada: custo de um
// SELECT indexado, sem cache de propósito. Cache faria suspensão e logout
// forçado demorarem pra valer, que é exatamente o que o painel promete.
export class UserSessionGuard implements SessionGuard {
  constructor(private readonly userRepository: UserRepository) {}

  async check(userId: string, tokenVersion: number): Promise<SessionVerdict> {
    const user = await this.userRepository.findById(userId)
    // Conta que sumiu (não acontece: é anonimizada, nunca apagada) conta como sessão encerrada.
    if (!user) return 'revoked'
    if (user.status === 'suspended') return 'suspended'
    if (user.tokenVersion !== tokenVersion) return 'revoked'
    return 'ok'
  }
}
