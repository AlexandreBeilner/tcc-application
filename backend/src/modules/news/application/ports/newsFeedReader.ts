import type {
  ListMacroEventsQuery,
  ListMacroEventsResult,
} from '../../../admin/application/ports/macroEventReader'

// RF16 (tela 5.1, tarefa 6.0.6) — mesmo contrato de paginação/formato de
// GET /admin/macro-events (modules/admin, tarefa 4.5): o feed público não
// agrega nem traduz nada (avaliado no início desta tarefa — `narrative` já
// é a versão amigável, `direction`/`magnitude_band` não precisam de
// mapeamento pra Português), só remove a exigência de `role = admin`.
// Reaproveita os tipos do admin em vez de duplicar um DTO idêntico.
export type NewsFeedQuery = ListMacroEventsQuery
export type NewsFeedResult = ListMacroEventsResult

export interface NewsFeedReader {
  list(query: NewsFeedQuery): Promise<NewsFeedResult>
}
