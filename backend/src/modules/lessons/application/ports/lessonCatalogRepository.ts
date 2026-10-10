import type { CatalogLesson, LessonFunnelCounts } from '../../domain/lessonCatalog'
import type { LessonContent } from '../../domain/lessonContent'

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

export type RevisionAction = 'baseline' | 'create' | 'update' | 'restore'

export interface LessonRevisionSummary {
  id: string
  action: RevisionAction
  // `null` só no baseline (retrato do estado de antes da primeira edição, vindo do seed).
  adminId: string | null
  adminUsername: string | null
  createdAt: Date
}

export interface LessonRevision extends LessonRevisionSummary {
  content: LessonContent
}

export interface NewLessonInput {
  content: LessonContent
  // A lição nova entra logo depois desta, na trilha dela. `null` entra no início do currículo.
  afterLessonId: string | null
}

export interface CreatedLesson {
  lesson: CatalogLesson
  // Quem já tinha passado daquele ponto recebe a lição como dispensa (N.24), pra não ser bloqueado.
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

  // Grava o conteúdo e a revisão na mesma transação. Se a lição ainda não tem revisão (veio do
  // seed), grava antes um 'baseline' com o conteúdo de antes, pra "restaurar" poder voltar ao
  // original. Devolve `undefined` se a lição não existe.
  updateContent(
    id: string,
    content: LessonContent,
    actorId: string,
    action: 'update' | 'restore',
  ): Promise<CatalogLesson | undefined>
  // Renumera o `sort_order` das seguintes, insere a lição (publicada, com `stable_key` e `code`
  // gerados), dispensa quem já passou do ponto e grava a revisão 'create', tudo numa transação.
  // Devolve `undefined` se `afterLessonId` não existe.
  create(input: NewLessonInput, actorId: string): Promise<CreatedLesson | undefined>
  // Mais recente primeiro.
  listRevisions(lessonId: string): Promise<LessonRevisionSummary[]>
  findRevision(lessonId: string, revisionId: string): Promise<LessonRevision | undefined>
}
