import { UserNotFoundError } from '../../domain/errors'
import type { UserRepository } from '../ports/userRepository'

export interface AnonymizeAccountInput {
  userId: string
}

// "Excluir conta" (tela 9.3) nunca é um DELETE físico da linha de `users` —
// market_events/positions/macro_events (motor) e as tabelas de gamificação
// guardam `user_id` como referência a um histórico imutável (Event
// Sourcing, CLAUDE.md) que não pode perder a FK. Em vez disso, anonimiza a
// identidade pessoal mantendo a linha e o `id` intactos — o rastro
// financeiro/gamificado continua existindo (histórico de mercado, ranking
// passado), só o nome/e-mail/username/senha somem e todos os provedores
// OAuth são desconectados. Usuário anonimizado não consegue mais logar
// (sem senha local, sem identidade OAuth).
export class AnonymizeAccountUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: AnonymizeAccountInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    // Sufixo curto do próprio id garante e-mail/username sintéticos únicos
    // sem precisar checar colisão contra outras contas já anonimizadas.
    const suffix = user.id.slice(0, 8)
    await this.userRepository.updateUser(input.userId, {
      name: 'Usuário removido',
      email: `usuario-removido-${suffix}@anonimo.invalid`,
      username: `usuario-removido-${suffix}`,
      passwordHash: null,
    })
    await this.userRepository.deleteIdentitiesForUser(input.userId)
  }
}
