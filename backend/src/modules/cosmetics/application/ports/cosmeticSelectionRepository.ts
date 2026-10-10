import type { CosmeticKind, CosmeticSelection } from '../../domain/cosmetic'

export interface CosmeticSelectionRepository {
  find(userId: string): Promise<CosmeticSelection>
  // Uma consulta pra vários usuários; quem não escolheu nada fica de fora do mapa.
  findMany(userIds: string[]): Promise<Map<string, CosmeticSelection>>
  equip(userId: string, kind: CosmeticKind, itemKey: string): Promise<void>
  unequip(userId: string, kind: CosmeticKind): Promise<void>
}
