import type { UserRole, UserStatus } from '../../auth/domain/user'

// Provedores de login de uma conta: 'password' (senha local) e os nomes de
// `user_identities` (hoje só 'google').
export type LoginProvider = string

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  username: string
  role: UserRole
  status: UserStatus
  onboardingCompleted: boolean
  providers: LoginProvider[]
  createdAt: Date
}
