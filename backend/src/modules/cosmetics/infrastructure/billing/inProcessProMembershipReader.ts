import type { ProMembershipReader } from '../../application/ports/proMembershipReader'

// Ponte em processo para o módulo `billing` (mesmo padrão de `inProcess*Reader` dos outros módulos):
// quem monta a composição passa o caso de uso, este arquivo só adapta a forma.
export function createInProcessProMembershipReader(source: {
  execute(userIds: string[]): Promise<Set<string>>
}): ProMembershipReader {
  return { listProUserIds: (userIds) => source.execute(userIds) }
}
