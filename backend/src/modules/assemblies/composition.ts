import { Router } from 'express'
import type { Redis } from 'ioredis'
import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import { AssemblyKindRegistry } from './application/assemblyKinds'
import { ApplyDueAssemblyEffectsUseCase } from './application/useCases/applyDueAssemblyEffects'
import { VoteAccessService } from './application/voteAccessService'
import { CastVoteUseCase } from './application/useCases/castVote'
import { GetMyVotingStatusUseCase } from './application/useCases/getMyVotingStatus'
import { GetAssemblyUseCase } from './application/useCases/getAssembly'
import { ListAssembliesUseCase } from './application/useCases/listAssemblies'
import { ListCompanyProposalsUseCase } from './application/useCases/listCompanyProposals'
import { ProposeAgendaUseCase } from './application/useCases/proposeAgenda'
import { SupportProposalUseCase } from './application/useCases/supportProposal'
import { WithdrawProposalSupportUseCase } from './application/useCases/withdrawProposalSupport'
import { AnnounceClosedAssembliesUseCase } from './application/useCases/announceClosedAssemblies'
import { CloseDueAssembliesUseCase } from './application/useCases/closeDueAssemblies'
import { CreateAssemblyUseCase } from './application/useCases/createAssembly'
import { OpenDueAssembliesUseCase } from './application/useCases/openDueAssemblies'
import { RunAssemblyLifecycleUseCase } from './application/useCases/runAssemblyLifecycle'
import { TallyAssemblyUseCase } from './application/useCases/tallyAssembly'
import { SHAREHOLDER_KIND, shareholderPolicies } from './domain/shareholderPolicies'
import type { AssemblyConfig } from './infrastructure/config/assemblyConfig'
import { createInProcessProStatus } from './infrastructure/billing/inProcessProStatus'
import { createInProcessParticipationRewards } from './infrastructure/gamification/inProcessParticipationRewards'
import { createNotificationsResultMailer } from './infrastructure/notifications/notificationsResultMailer'
import { createInProcessResultFeed } from './infrastructure/socialfeed/inProcessResultFeed'
import { createInProcessVoterProfileReader } from './infrastructure/profile/inProcessVoterProfileReader'
import { createAssembliesRouter } from './interfaces/http/assembliesRouter'
import { createAssemblyReadsRouter } from './interfaces/http/assemblyReadsRouter'
import { createRedisScoreboardCache } from './infrastructure/cache/redisScoreboardCache'
import { createProposalsRouter } from './interfaces/http/proposalsRouter'
import { createEngineCompanyCooldownReader } from './infrastructure/engine/engineCompanyCooldownReader'
import { createEngineCompanyStandingReader } from './infrastructure/engine/engineCompanyStandingReader'
import { createDrizzleProposalRepository } from './infrastructure/persistence/drizzleProposalRepository'
import { createEngineCompanyReportSource } from './infrastructure/engine/engineCompanyReportSource'
import { createEngineDeclarationSource } from './infrastructure/engine/engineDeclarationSource'
import { createEngineHoldingsSnapshotProvider } from './infrastructure/engine/engineHoldingsSnapshotProvider'
import { createEngineShareholderEffect } from './infrastructure/engine/engineShareholderEffect'
import { createDrizzleAgendaCatalog } from './infrastructure/persistence/drizzleAgendaCatalog'
import { createDrizzleAssemblyRepository } from './infrastructure/persistence/drizzleAssemblyRepository'
import { createDrizzleAgendaCatalogAdmin } from './infrastructure/persistence/drizzleAgendaCatalogAdmin'
import { createDrizzleAssemblyPauseRepository } from './infrastructure/persistence/drizzleAssemblyPauseRepository'
import { createDrizzleAssemblySettingsStore } from './infrastructure/persistence/drizzleAssemblySettingsStore'
import { AssemblySettingsService } from './application/assemblySettingsService'
import {
  GetAdminAssemblyDetailUseCase,
  ListAdminAssembliesUseCase,
} from './application/useCases/adminAssemblies'
import {
  CreateAgendaTemplateUseCase,
  ListAgendaTemplatesAdminUseCase,
  SetAgendaTemplateActiveUseCase,
  UpdateAgendaTemplateUseCase,
} from './application/useCases/agendaTemplatesAdmin'
import {
  LiftAssemblyPauseUseCase,
  ListAssemblyPausesUseCase,
  PauseAssembliesUseCase,
} from './application/useCases/assemblyPauses'

// Composição do módulo `assemblies` (único lugar que instancia os adapters concretos). Hoje só
// devolve o job do ciclo (abrir, fechar e aplicar), ligado em `server.ts`, e o router (voto e
// "minha situação", propostas de pauta e apoio; leitura e placar entram na MO.6.6).
// Parte do módulo que o painel usa e que existe mesmo com o recurso desligado: parâmetros, pausas,
// catálogo de pautas e leitura das assembleias (MO.6.8). Editar parâmetros e pautas antes de ligar
// é o que a calibração (MO.6.9) precisa. `config` é o objeto vivo que o resto do módulo lê.
export interface AssemblyAdminCoreDeps {
  db: Database
  engineUrl: string
  config: AssemblyConfig
}

export function createAssemblyKinds(engineUrl: string): AssemblyKindRegistry {
  return new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: createEngineShareholderEffect(engineUrl),
  })
}

export function createAssemblyAdminCore(deps: AssemblyAdminCoreDeps) {
  const repository = createDrizzleAssemblyRepository(deps.db)
  const pauses = createDrizzleAssemblyPauseRepository(deps.db)
  const snapshots = createEngineHoldingsSnapshotProvider(deps.engineUrl)
  const kinds = createAssemblyKinds(deps.engineUrl)
  const catalogAdmin = createDrizzleAgendaCatalogAdmin(deps.db)
  // O valor inicial (env ou padrão) é a cópia de antes de qualquer edição do painel.
  const settings = new AssemblySettingsService(
    structuredClone(deps.config),
    deps.config,
    createDrizzleAssemblySettingsStore(deps.db),
  )
  return {
    repository,
    pauses,
    snapshots,
    kinds,
    settings,
    listAssemblies: new ListAdminAssembliesUseCase(repository, pauses),
    getAssembly: new GetAdminAssemblyDetailUseCase(
      kinds,
      repository,
      snapshots,
      pauses,
      () => deps.config.params.minVoters,
    ),
    listPauses: new ListAssemblyPausesUseCase(pauses),
    pauseAssemblies: new PauseAssembliesUseCase(pauses),
    liftPause: new LiftAssemblyPauseUseCase(pauses),
    listTemplates: new ListAgendaTemplatesAdminUseCase(catalogAdmin),
    createTemplate: new CreateAgendaTemplateUseCase(catalogAdmin),
    updateTemplate: new UpdateAgendaTemplateUseCase(catalogAdmin),
    setTemplateActive: new SetAgendaTemplateActiveUseCase(catalogAdmin),
  }
}

export type AssemblyAdminCore = ReturnType<typeof createAssemblyAdminCore>

export interface AssembliesCompositionDeps {
  config: AssemblyConfig
  // Repositório, pausas, parâmetros e kinds compartilhados com o painel.
  core: AssemblyAdminCore
  engineUrl: string
  db: Database
  authMiddleware: AuthMiddleware
  // Cache curto do placar de assembleia aberta.
  redis: Redis
  // Do módulo `billing`: único jeito de gatear PRO (`ProAccessGuard`).
  proAccess: { assertPro(userId: string): Promise<void> }
  // Do módulo `gamification` e do `auth`: nível e e-mail verificado do crédito gratuito.
  getProgression: Parameters<typeof createInProcessVoterProfileReader>[0]['getProgression']
  userRepository: Parameters<typeof createInProcessVoterProfileReader>[0]['userRepository']
  // Do módulo `gamification`: XP de participação (e, por ele, a conquista "Acionista ativo").
  awardXp: Parameters<typeof createInProcessParticipationRewards>[0]
  // Do módulo `socialfeed`: linha de participação no feed dos amigos, no fechamento.
  recordAssemblyParticipation: Parameters<typeof createInProcessResultFeed>[0]
  // Do módulo `notifications`: e-mail opt-in (categoria `social`) do resultado.
  enqueueEmail: Parameters<typeof createNotificationsResultMailer>[0]['enqueueEmail']
  recipients: Parameters<typeof createNotificationsResultMailer>[0]['recipients']
}

export function createAssembliesModule(deps: AssembliesCompositionDeps) {
  const { repository, snapshots, kinds, pauses } = deps.core

  const agendaCatalog = createDrizzleAgendaCatalog(deps.db)
  const proposals = createDrizzleProposalRepository(deps.db)
  const standings = createEngineCompanyStandingReader(deps.engineUrl)
  const declarations = createEngineDeclarationSource(deps.engineUrl)
  const proStatus = createInProcessProStatus(deps.proAccess)
  const proposalParams = () => deps.config.proposals

  const create = new CreateAssemblyUseCase(kinds, repository)
  const tally = new TallyAssemblyUseCase(kinds, repository, snapshots, () => deps.config.params)
  const runAssemblyLifecycle = new RunAssemblyLifecycleUseCase(
    new CloseDueAssembliesUseCase(repository, tally, declarations),
    new OpenDueAssembliesUseCase(
      create,
      repository,
      createEngineCompanyReportSource(deps.engineUrl),
      agendaCatalog,
      snapshots,
      proposals,
      () => deps.config.proposals,
      () => deps.config.lifecycle,
      pauses,
      createEngineCompanyCooldownReader(standings),
      declarations,
      () => deps.config.params.minVoters,
    ),
    new ApplyDueAssemblyEffectsUseCase(kinds, repository, pauses),
    new AnnounceClosedAssembliesUseCase(
      kinds,
      repository,
      snapshots,
      createInProcessResultFeed(deps.recordAssemblyParticipation),
      createNotificationsResultMailer({
        enqueueEmail: deps.enqueueEmail,
        recipients: deps.recipients,
      }),
    ),
    () => deps.core.settings.refresh(),
  )
  const access = new VoteAccessService(
    kinds,
    repository,
    snapshots,
    proStatus,
    createInProcessVoterProfileReader(deps),
    () => deps.config.params,
  )
  const router = Router()
  router.use(
    createAssembliesRouter({
      castVote: new CastVoteUseCase(
        access,
        repository,
        () => deps.config.params,
        undefined,
        createInProcessParticipationRewards(deps.awardXp, () => deps.config.participationXp),
      ),
      getMyVotingStatus: new GetMyVotingStatusUseCase(access, () => deps.config.params),
      authMiddleware: deps.authMiddleware,
    }),
  )
  router.use(
    createAssemblyReadsRouter({
      listAssemblies: new ListAssembliesUseCase(repository),
      getAssembly: new GetAssemblyUseCase(
        kinds,
        repository,
        snapshots,
        agendaCatalog,
        createRedisScoreboardCache(deps.redis),
        () => deps.config.params.minVoters,
      ),
      authMiddleware: deps.authMiddleware,
    }),
  )
  router.use(
    createProposalsRouter({
      listCompanyProposals: new ListCompanyProposalsUseCase(
        standings,
        agendaCatalog,
        proposals,
        proStatus,
        proposalParams,
      ),
      proposeAgenda: new ProposeAgendaUseCase(
        deps.proAccess,
        standings,
        agendaCatalog,
        proposals,
        proposalParams,
      ),
      supportProposal: new SupportProposalUseCase(
        deps.proAccess,
        standings,
        proposals,
        proposalParams,
      ),
      withdrawSupport: new WithdrawProposalSupportUseCase(proposals),
      authMiddleware: deps.authMiddleware,
    }),
  )
  return { kinds, repository, proposals, create, tally, runAssemblyLifecycle, router }
}
