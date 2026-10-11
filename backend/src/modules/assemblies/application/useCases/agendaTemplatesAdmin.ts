import { AgendaTemplateConflictError, AgendaTemplateNotFoundError } from '../../domain/errors'
import {
  validateTemplateInput,
  validateTemplateKey,
  type AgendaTemplateAdminView,
  type AgendaTemplateInput,
} from '../../domain/agendaTemplates'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import type { AgendaCatalogAdmin } from '../ports/agendaCatalogAdmin'

export class ListAgendaTemplatesAdminUseCase {
  constructor(private readonly catalog: AgendaCatalogAdmin) {}

  execute(): Promise<AgendaTemplateAdminView[]> {
    return this.catalog.listAll(SHAREHOLDER_KIND)
  }
}

// Cria uma pauta nova no catálogo (nasce ativa). A chave é definitiva: propostas e assembleias a
// referenciam, por isso editar nunca a troca.
export class CreateAgendaTemplateUseCase {
  constructor(private readonly catalog: AgendaCatalogAdmin) {}

  async execute(key: string, input: AgendaTemplateInput): Promise<AgendaTemplateAdminView> {
    const clean = validateTemplateInput(input)
    const result = await this.catalog.create(SHAREHOLDER_KIND, validateTemplateKey(key), clean)
    if (result.status === 'conflict') {
      throw new AgendaTemplateConflictError('já existe uma pauta com essa chave')
    }
    return result.template
  }
}

// Edita o conteúdo de uma pauta. Vale para as próximas assembleias e para as propostas na fila:
// as assembleias já abertas guardam a própria cópia das opções e não mudam.
export class UpdateAgendaTemplateUseCase {
  constructor(private readonly catalog: AgendaCatalogAdmin) {}

  async execute(key: string, input: AgendaTemplateInput): Promise<AgendaTemplateAdminView> {
    const updated = await this.catalog.update(SHAREHOLDER_KIND, key, validateTemplateInput(input))
    if (!updated) throw new AgendaTemplateNotFoundError('pauta não encontrada')
    return updated
  }
}

// Desativar tira a pauta do sorteio e das propostas novas; nunca se apaga (referências).
export class SetAgendaTemplateActiveUseCase {
  constructor(private readonly catalog: AgendaCatalogAdmin) {}

  async execute(key: string, active: boolean): Promise<AgendaTemplateAdminView> {
    const updated = await this.catalog.setActive(SHAREHOLDER_KIND, key, active)
    if (!updated) throw new AgendaTemplateNotFoundError('pauta não encontrada')
    return updated
  }
}
