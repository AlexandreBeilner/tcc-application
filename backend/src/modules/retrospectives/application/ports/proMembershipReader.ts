// Quem, dentre estes usuários, é PRO agora (em lote). Implementada sobre o módulo `billing`.
export interface ProMembershipReader {
  listProUserIds(userIds: string[]): Promise<Set<string>>
}
