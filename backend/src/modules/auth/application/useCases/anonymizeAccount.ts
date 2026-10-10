import { UserNotFoundError } from '../../domain/errors'
import { notifySafely } from '../notifySafely'
import type { AccountMailer } from '../ports/accountMailer'
import type { AvatarStorage } from '../ports/avatarStorage'
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
// (sem senha local, sem identidade OAuth). Foto de perfil (tarefa 6.10.8)
// também é removida aqui — sem isso, `GET /avatars/<arquivo>` (estático,
// sem checagem de dono) continuaria servindo a foto real de alguém que já
// pediu a exclusão da própria conta.
export class AnonymizeAccountUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly avatarStorage: AvatarStorage,
    private readonly accountMailer: AccountMailer,
  ) {}

  async execute(input: AnonymizeAccountInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    // Confirmação da exclusão (E7) vai ao endereço real, por isso antes de ele virar `.invalid`.
    // O outbox guarda o endereço de entrega, então o envio acontece mesmo depois da anonimização.
    // Conta já anonimizada cai na recusa de `.invalid` do enfileiramento, sem e-mail.
    await notifySafely('a confirmação de exclusão', () =>
      this.accountMailer.sendAccountDeleted({
        userId: user.id,
        to: user.email,
        eventId: user.id,
      }),
    )

    // Sufixo curto do próprio id garante e-mail/username sintéticos únicos
    // sem precisar checar colisão contra outras contas já anonimizadas.
    const suffix = user.id.slice(0, 8)
    await this.userRepository.updateUser(input.userId, {
      name: 'Usuário removido',
      email: `usuario-removido-${suffix}@anonimo.invalid`,
      username: `usuario-removido-${suffix}`,
      passwordHash: null,
      avatarPath: null,
    })
    await this.userRepository.deleteIdentitiesForUser(input.userId)
    // Encerra as sessões abertas (N.16): token emitido antes da exclusão não vale mais.
    await this.userRepository.revokeSessions(input.userId)

    if (user.avatarPath) {
      await this.avatarStorage.delete(user.avatarPath)
    }
  }
}
