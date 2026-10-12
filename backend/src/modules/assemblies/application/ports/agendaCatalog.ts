import type { AgendaTemplate } from '../../domain/lifecycle'

export interface AgendaCatalog {
  // Pautas ativas de um kind (o catálogo cresce por linha nova, sem mudar código).
  listActive(kind: string): Promise<AgendaTemplate[]>
}
