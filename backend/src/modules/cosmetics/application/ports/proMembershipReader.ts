// Quem, dentre estes usuários, é PRO agora. Implementada sobre o módulo `billing`; nunca claim de
// JWT.
export interface ProMembershipReader {
  listProUserIds(userIds: string[]): Promise<Set<string>>
}
