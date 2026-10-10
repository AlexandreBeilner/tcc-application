// Leitura direta de `users` — mesmo banco `gamification`, mesmo padrão de
// `ranking/application/ports/userDirectory.ts` (cada módulo com sua própria
// porta mínima, mesmo sendo a mesma tabela física por baixo). O job
// periódico (T.5) precisa de todo usuário real pra decidir, um a um, se
// venceu salário — nunca inclui bot (bots não têm linha em `users`, só em
// `accounts` no motor, decisão já registrada na Fase A deste backlog).
export interface UserDirectory {
  listAllUserIds(): Promise<string[]>
}
