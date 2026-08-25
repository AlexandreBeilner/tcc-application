import type { IdentityRecord, UserRepository } from '../ports/userRepository'

export interface ListIdentitiesInput {
  userId: string
}

// Provedores OAuth conectados (tela 9.2), sem tokens — IdentityRecord já
// não carrega accessToken/refreshToken (ver drizzleUserRepository.listIdentitiesForUser).
export class ListIdentitiesUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: ListIdentitiesInput): Promise<IdentityRecord[]> {
    return this.userRepository.listIdentitiesForUser(input.userId)
  }
}
