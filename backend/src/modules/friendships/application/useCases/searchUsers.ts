import type { UserDirectory, UserSummary } from '../ports/userDirectory'

export interface SearchUsersInput {
  userId: string
  query: string
}

export class SearchUsersUseCase {
  constructor(private readonly userDirectory: UserDirectory) {}

  async execute(input: SearchUsersInput): Promise<UserSummary[]> {
    return this.userDirectory.searchByUsername(input.query, input.userId)
  }
}
