import type { AdminUserSummary } from '../../domain/adminUser'
import type { UserRole, UserStatus } from '../../../auth/domain/user'

export interface ListAdminUsersQuery {
  // Texto livre: nome, e-mail ou username (contém, sem caixa) ou o id exato.
  q?: string
  role?: UserRole
  status?: UserStatus
  // 'password' (senha local) ou o nome de um provedor OAuth ('google').
  provider?: string
  createdFrom?: Date
  createdTo?: Date
  limit: number
  offset: number
}

export interface ListAdminUsersResult {
  users: AdminUserSummary[]
  total: number
}

// Consulta de contas no banco usuário/gamificação, só pro painel admin.
export interface AdminUserDirectory {
  list(query: ListAdminUsersQuery): Promise<ListAdminUsersResult>
}
