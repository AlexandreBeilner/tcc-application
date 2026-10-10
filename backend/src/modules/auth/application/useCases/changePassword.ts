import { randomUUID } from 'node:crypto'
import { InvalidCredentialsError, UserNotFoundError } from '../../domain/errors'
import { hasLocalPassword } from '../../domain/user'
import type { AuthMailer } from '../ports/authMailer'
import type { PasswordHasher } from '../ports/passwordHasher'
import type { UserRepository } from '../ports/userRepository'

export interface ChangePasswordInput {
  userId: string
  // Obrigatório só se a conta já tem senha local — ver hasLocalPassword.
  currentPassword?: string
  newPassword: string
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly mailer: AuthMailer,
    // Cada troca é um evento novo: o id só serve de chave de idempotência do aviso.
    private readonly newEventId: () => string = randomUUID,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    if (hasLocalPassword(user)) {
      if (!input.currentPassword) {
        throw new InvalidCredentialsError('senha atual obrigatória')
      }
      // user.passwordHash não é null aqui (hasLocalPassword já garantiu).
      const valid = await this.passwordHasher.verify(
        input.currentPassword,
        user.passwordHash as string,
      )
      if (!valid) {
        throw new InvalidCredentialsError('senha atual incorreta')
      }
    }
    // Conta só-OAuth (password_hash null): aceita setar a primeira senha
    // sem exigir currentPassword — passa a ter os dois métodos de login
    // disponíveis dali em diante, sem tirar o OAuth.

    const passwordHash = await this.passwordHasher.hash(input.newPassword)
    await this.userRepository.updateUser(input.userId, { passwordHash })

    // A senha já mudou: falha em enfileirar o aviso (E4) não pode desfazer nem derrubar a troca.
    // As outras sessões seguem abertas (quem trocou continua logado), por isso o texto não diz
    // que foram encerradas.
    try {
      await this.mailer.sendPasswordChanged({
        userId: user.id,
        to: user.email,
        name: user.name,
        eventId: this.newEventId(),
        sessionsEnded: false,
      })
    } catch (err) {
      console.error('[auth] falha ao enfileirar o aviso de senha alterada', err)
    }
  }
}
