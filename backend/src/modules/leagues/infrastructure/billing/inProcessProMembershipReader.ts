import type { ProMembershipReader } from '../../application/ports/proMembershipReader'

// Ponte em processo para o módulo `billing` (leitura em lote de quem é PRO agora).
export function createInProcessProMembershipReader(source: {
  execute(userIds: string[]): Promise<Set<string>>
}): ProMembershipReader {
  return { listProUserIds: (userIds) => source.execute(userIds) }
}
