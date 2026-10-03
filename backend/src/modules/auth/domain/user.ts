export type UserRole = 'user' | 'admin'

// Suspensão pelo painel admin (N.16): conta suspensa não loga nem usa token,
// mas mantém todo o progresso.
export type UserStatus = 'active' | 'suspended'

export interface User {
  id: string
  name: string
  email: string
  username: string
  passwordHash: string | null
  role: UserRole
  onboardingCompleted: boolean
  // Nome do arquivo salvo em disco (tarefa 6.10.8), não a URL pronta —
  // `userSerializer.ts` monta a URL pública a partir daqui. `null` até o
  // primeiro upload; sem fallback pra iniciais neste nível (isso é UI).
  avatarPath: string | null
  status: UserStatus
  suspendedReason: string | null
  suspendedAt: Date | null
  // Versão de sessão: `forçar logout` incrementa e todo token emitido antes
  // (com versão menor) passa a ser recusado.
  tokenVersion: number
  createdAt: Date
}

// Contas criadas só via OAuth (Google) não têm senha local — ver
// .claude/der-original-tcc.md, "password_hash passa a ser nullable".
export function hasLocalPassword(user: User): boolean {
  return user.passwordHash !== null
}
