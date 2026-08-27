export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  username: string
  passwordHash: string | null
  role: UserRole
  onboardingCompleted: boolean
  createdAt: Date
}

// Contas criadas só via OAuth (Google) não têm senha local — ver
// .claude/der-original-tcc.md, "password_hash passa a ser nullable".
export function hasLocalPassword(user: User): boolean {
  return user.passwordHash !== null
}
