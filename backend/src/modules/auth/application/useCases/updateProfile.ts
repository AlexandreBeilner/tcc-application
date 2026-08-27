import {
  EmailAlreadyInUseError,
  UsernameAlreadyInUseError,
  UserNotFoundError,
} from '../../domain/errors'
import type { User } from '../../domain/user'
import type { UserRepository } from '../ports/userRepository'

export interface UpdateProfileInput {
  userId: string
  name?: string
  email?: string
  username?: string
  onboardingCompleted?: boolean
}

// Checagem de conflito de e-mail/username antes de persistir — a UNIQUE do
// banco é a garantia final, mas devolve um erro de negócio claro (409, tela
// 9.2) em vez de deixar o Postgres estourar a constraint crua.
export class UpdateProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UpdateProfileInput): Promise<User> {
    const current = await this.userRepository.findById(input.userId)
    if (!current) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    if (input.email && input.email !== current.email) {
      const existing = await this.userRepository.findByEmail(input.email)
      if (existing) {
        throw new EmailAlreadyInUseError('e-mail já cadastrado')
      }
    }

    if (input.username && input.username !== current.username) {
      const existing = await this.userRepository.findByUsername(input.username)
      if (existing) {
        throw new UsernameAlreadyInUseError('username já em uso')
      }
    }

    return this.userRepository.updateUser(input.userId, {
      name: input.name,
      email: input.email,
      username: input.username,
      onboardingCompleted: input.onboardingCompleted,
    })
  }
}
