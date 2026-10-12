import type {
  AdminAssemblyDetailView,
  AdminAssemblyRow,
  AgendaTemplateAdminItem,
  AgendaTemplateContent,
  AssemblyAdmin,
  AssemblyPauseListing,
  AssemblyPauseView,
  AssemblySettingRow,
  AssemblyStatus,
  PauseAssembliesInput,
} from '../ports/assemblyAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Leituras do painel das assembleias (MO.6.8). Voto por pessoa visível ao admin, e a leitura não é
// auditada: mesma exceção deliberada do patrimônio absoluto (a regra de privacidade vale entre
// usuários, não para o administrador). Só escrita grava auditoria, nos casos de uso abaixo.
export class ListAssembliesAdminUseCase {
  constructor(private readonly assemblyAdmin: AssemblyAdmin) {}

  execute(status?: AssemblyStatus): Promise<AdminAssemblyRow[]> {
    return this.assemblyAdmin.listAssemblies(status)
  }
}

export class GetAssemblyAdminDetailUseCase {
  constructor(private readonly assemblyAdmin: AssemblyAdmin) {}

  execute(id: string): Promise<AdminAssemblyDetailView> {
    return this.assemblyAdmin.getAssembly(id)
  }
}

export class ListAssemblyPausesAdminUseCase {
  constructor(private readonly assemblyAdmin: AssemblyAdmin) {}

  execute(): Promise<AssemblyPauseListing> {
    return this.assemblyAdmin.listPauses()
  }
}

export class ListAssemblySettingsAdminUseCase {
  constructor(private readonly assemblyAdmin: AssemblyAdmin) {}

  execute(): Promise<AssemblySettingRow[]> {
    return this.assemblyAdmin.listSettings()
  }
}

export class ListAgendaTemplatesAdminUseCase {
  constructor(private readonly assemblyAdmin: AssemblyAdmin) {}

  execute(): Promise<AgendaTemplateAdminItem[]> {
    return this.assemblyAdmin.listTemplates()
  }
}

// Pausar impede abrir e aplicar; nada se perde. Auditada inclusive quando recusada (409 já pausada).
export class PauseAssembliesAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, input: PauseAssembliesInput): Promise<AssemblyPauseView> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'assembly.pause',
        targetType: 'assembly_pause',
        payload: {
          scope: input.scope,
          subject_ref: input.subjectRef ?? null,
          reason: input.reason,
        },
      },
      () => this.assemblyAdmin.pause(adminId, input),
      (pause) => ({ targetId: pause.id }),
    )
  }
}

export class LiftAssemblyPauseAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, pauseId: string): Promise<AssemblyPauseView> {
    return this.recordAdminAction.run(
      { adminId, action: 'assembly.resume', targetType: 'assembly_pause', targetId: pauseId },
      () => this.assemblyAdmin.lift(adminId, pauseId),
    )
  }
}

// Altera um parâmetro. Vale para as próximas assembleias; o quórum de uma aberta fica congelado nela.
// O valor novo vai no payload; o anterior está na linha de auditoria anterior da mesma chave.
export class UpdateAssemblySettingAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, key: string, value: number): Promise<AssemblySettingRow[]> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'assembly.setting_update',
        targetType: 'assembly_setting',
        targetId: key,
        payload: { key, value },
      },
      () => this.assemblyAdmin.setSetting(adminId, key, value),
    )
  }
}

export class ResetAssemblySettingAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, key: string): Promise<AssemblySettingRow[]> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'assembly.setting_reset',
        targetType: 'assembly_setting',
        targetId: key,
        payload: { key },
      },
      () => this.assemblyAdmin.resetSetting(adminId, key),
    )
  }
}

function contentPayload(content: AgendaTemplateContent): Record<string, unknown> {
  return {
    sector: content.sector,
    title: content.title,
    options: content.options.map((o) => o.key),
  }
}

export class CreateAgendaTemplateAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, key: string, content: AgendaTemplateContent) {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'assembly.template_create',
        targetType: 'agenda_template',
        targetId: key,
        payload: contentPayload(content),
      },
      () => this.assemblyAdmin.createTemplate(key, content),
    )
  }
}

// Edita o conteúdo: vale para as próximas assembleias e para as propostas na fila; as já abertas
// guardam a própria cópia das opções.
export class UpdateAgendaTemplateAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, key: string, content: AgendaTemplateContent) {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'assembly.template_update',
        targetType: 'agenda_template',
        targetId: key,
        payload: contentPayload(content),
      },
      () => this.assemblyAdmin.updateTemplate(key, content),
    )
  }
}

export class SetAgendaTemplateActiveAdminUseCase {
  constructor(
    private readonly assemblyAdmin: AssemblyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, key: string, active: boolean) {
    return this.recordAdminAction.run(
      {
        adminId,
        action: active ? 'assembly.template_activate' : 'assembly.template_deactivate',
        targetType: 'agenda_template',
        targetId: key,
      },
      () => this.assemblyAdmin.setTemplateActive(key, active),
    )
  }
}
