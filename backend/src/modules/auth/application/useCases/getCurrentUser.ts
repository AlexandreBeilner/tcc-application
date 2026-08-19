import { UserNotFoundError } from '../../domain/errors'
import type { User } from '../../domain/user'
import type { UserRepository } from '../ports/userRepository'

export interface GetCurrentUserInput {
  userId: string
}

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }
    return user
  }
}
