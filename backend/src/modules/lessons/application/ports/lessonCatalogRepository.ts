import type { CatalogLesson, LessonFunnelCounts } from '../../domain/lessonCatalog'

export interface CatalogRow {
  lesson: CatalogLesson
  funnel: LessonFunnelCounts
}

export interface PublishChangeResult {
  lesson: CatalogLesson
  // Quantos usuários receberam dispensa da lição ao publicá-la (N.24): quem já tinha passado
  // daquele ponto da trilha não é bloqueado por uma lição que voltou a existir.
  waivedUsers: number
}

// Repositório do catálogo de lições pro painel (N.18/N.23). Separado de `LessonRepository` de
// propósito: aquele é a leitura do jogador (só publicadas, sem métricas); este enxerga tudo.
export interface LessonCatalogRepository {
  // Todas as lições, publicadas ou não, em ordem de `sortOrder`, com o funil de cada uma.
  listWithFunnel(): Promise<CatalogRow[]>
  findById(id: string): Promise<CatalogLesson | undefined>
  // Liga ou desliga a publicação, numa transação. Ao publicar, concede dispensa a quem já passou
  // daquela posição. Devolve `undefined` se a lição não existe.
  setPublished(id: string, published: boolean): Promise<PublishChangeResult | undefined>
}
