import type {
  AdminUserDirectory,
  ListAdminUsersQuery,
  ListAdminUsersResult,
} from '../ports/adminUserDirectory'

// Delegação fina (leitura), mesmo padrão de ListAdminOrdersUseCase.
export class ListAdminUsersUseCase {
  constructor(private readonly directory: AdminUserDirectory) {}

  async execute(query: ListAdminUsersQuery): Promise<ListAdminUsersResult> {
    return this.directory.list(query)
  }
}
