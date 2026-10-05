import type { AdminUserSummary } from '../../../services/admin'

export interface AdminUsersTableProps {
    users: AdminUserSummary[]
    emptyMessage: string
}
