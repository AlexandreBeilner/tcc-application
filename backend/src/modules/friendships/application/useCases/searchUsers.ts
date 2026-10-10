import {
  NO_COSMETICS,
  type CosmeticsReader,
  type PublicCosmetics,
} from '../../../../shared/publicCosmetics'
import type { UserDirectory, UserSummary } from '../ports/userDirectory'

export interface SearchUsersInput {
  userId: string
  query: string
}

export type SearchUserResult = UserSummary & { cosmetics: PublicCosmetics }

export class SearchUsersUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly cosmeticsReader?: CosmeticsReader,
  ) {}

  async execute(input: SearchUsersInput): Promise<SearchUserResult[]> {
    const users = await this.userDirectory.searchByUsername(input.query, input.userId)
    const displays =
      (await this.cosmeticsReader?.findDisplays(users.map((user) => user.id))) ??
      new Map<string, PublicCosmetics>()
    return users.map((user) => ({ ...user, cosmetics: displays.get(user.id) ?? NO_COSMETICS }))
  }
}
