import type { AgendaTemplateAdminView, AgendaTemplateInput } from '../../domain/agendaTemplates'

export type CreateTemplateResult =
  { status: 'created'; template: AgendaTemplateAdminView } | { status: 'conflict' }

// Catálogo de pautas visto pelo painel (MO.6.8): todas as pautas, ativas ou não, com o uso.
export interface AgendaCatalogAdmin {
  listAll(kind: string): Promise<AgendaTemplateAdminView[]>
  find(kind: string, key: string): Promise<AgendaTemplateAdminView | null>
  create(kind: string, key: string, input: AgendaTemplateInput): Promise<CreateTemplateResult>
  // `null` se a pauta não existe. Nunca apaga: só edita conteúdo.
  update(
    kind: string,
    key: string,
    input: AgendaTemplateInput,
  ): Promise<AgendaTemplateAdminView | null>
  setActive(kind: string, key: string, active: boolean): Promise<AgendaTemplateAdminView | null>
}
