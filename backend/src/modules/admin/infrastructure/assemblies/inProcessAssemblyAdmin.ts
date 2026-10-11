import type { AssemblySettingsService } from '../../../assemblies/application/assemblySettingsService'
import type {
  GetAdminAssemblyDetailUseCase,
  ListAdminAssembliesUseCase,
} from '../../../assemblies/application/useCases/adminAssemblies'
import type {
  CreateAgendaTemplateUseCase,
  ListAgendaTemplatesAdminUseCase as ListTemplates,
  SetAgendaTemplateActiveUseCase,
  UpdateAgendaTemplateUseCase,
} from '../../../assemblies/application/useCases/agendaTemplatesAdmin'
import type {
  LiftAssemblyPauseUseCase,
  ListAssemblyPausesUseCase,
  PauseAssembliesUseCase,
} from '../../../assemblies/application/useCases/assemblyPauses'
import {
  AgendaTemplateConflictError,
  AgendaTemplateNotFoundError,
  AssemblyNotFoundError,
  AssemblyPauseConflictError,
  AssemblyPauseNotFoundError,
  InvalidAgendaTemplateError,
  InvalidAssemblyPauseError,
  InvalidAssemblySettingError,
} from '../../../assemblies/domain/errors'
import { SHAREHOLDER_KIND } from '../../../assemblies/domain/shareholderPolicies'
import {
  AdminAssemblyConflictError,
  AdminAssemblyNotFoundError,
  InvalidAdminAssemblyError,
} from '../../domain/errors'
import type { AssemblyAdmin } from '../../application/ports/assemblyAdmin'

export interface VoterIdentity {
  username: string
  name: string
}

export interface InProcessAssemblyAdminDeps {
  listAssemblies: ListAdminAssembliesUseCase
  getAssembly: GetAdminAssemblyDetailUseCase
  listPauses: ListAssemblyPausesUseCase
  pauseAssemblies: PauseAssembliesUseCase
  liftPause: LiftAssemblyPauseUseCase
  settings: AssemblySettingsService
  listTemplates: ListTemplates
  createTemplate: CreateAgendaTemplateUseCase
  updateTemplate: UpdateAgendaTemplateUseCase
  setTemplateActive: SetAgendaTemplateActiveUseCase
  // Nome e username de quem votou (o painel mostra a pessoa, não só o id).
  readVoters(userIds: string[]): Promise<Map<string, VoterIdentity>>
}

// Traduz as recusas do módulo dono (assembleias) pros erros do painel, pra o router mapear
// 404/409/422 sem conhecer esse módulo.
function translate(err: unknown): never {
  if (
    err instanceof AssemblyNotFoundError ||
    err instanceof AssemblyPauseNotFoundError ||
    err instanceof AgendaTemplateNotFoundError
  ) {
    throw new AdminAssemblyNotFoundError(err.message || 'não encontrado')
  }
  if (err instanceof AssemblyPauseConflictError || err instanceof AgendaTemplateConflictError) {
    throw new AdminAssemblyConflictError(err.message)
  }
  if (
    err instanceof InvalidAssemblySettingError ||
    err instanceof InvalidAssemblyPauseError ||
    err instanceof InvalidAgendaTemplateError
  ) {
    throw new InvalidAdminAssemblyError(err.message)
  }
  throw err
}

async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    return translate(err)
  }
}

export function createInProcessAssemblyAdmin(deps: InProcessAssemblyAdminDeps): AssemblyAdmin {
  return {
    listAssemblies: (status) => guarded(() => deps.listAssemblies.execute(status)),
    getAssembly: (id) =>
      guarded(async () => {
        const detail = await deps.getAssembly.execute(id)
        const voters = await deps.readVoters([...new Set(detail.votes.map((v) => v.userId))])
        return {
          ...detail,
          votes: detail.votes.map((vote) => ({
            ...vote,
            username: voters.get(vote.userId)?.username ?? null,
            name: voters.get(vote.userId)?.name ?? null,
          })),
        }
      }),
    listPauses: () => guarded(() => deps.listPauses.execute()),
    pause: (adminId, input) =>
      guarded(() =>
        deps.pauseAssemblies.execute(
          adminId,
          input.scope === 'global'
            ? { scope: 'global', reason: input.reason }
            : {
                scope: 'subject',
                kind: SHAREHOLDER_KIND,
                subjectRef: input.subjectRef,
                reason: input.reason,
              },
        ),
      ),
    lift: (adminId, pauseId) => guarded(() => deps.liftPause.execute(adminId, pauseId)),
    listSettings: () => guarded(() => deps.settings.list()),
    setSetting: (adminId, key, value) => guarded(() => deps.settings.set(key, value, adminId)),
    resetSetting: (_adminId, key) => guarded(() => deps.settings.reset(key)),
    listTemplates: () => guarded(() => deps.listTemplates.execute()),
    createTemplate: (key, content) =>
      guarded(() => deps.createTemplate.execute(key, content)),
    updateTemplate: (key, content) =>
      guarded(() => deps.updateTemplate.execute(key, content)),
    setTemplateActive: (key, active) => guarded(() => deps.setTemplateActive.execute(key, active)),
  }
}
