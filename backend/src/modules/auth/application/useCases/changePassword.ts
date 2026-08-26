import { InvalidCredentialsError, UserNotFoundError } from '../../domain/errors'
import { hasLocalPassword } from '../../domain/user'
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
  }
}
