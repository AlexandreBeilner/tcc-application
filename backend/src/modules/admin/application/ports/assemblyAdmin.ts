// Painel das assembleias (MO.6.8): leitura com voto por pessoa, pausa, parâmetros e catálogo de
// pautas. A regra de cada uma vive no módulo `assemblies`; aqui só o contrato que o painel usa.
export type AssemblyStatus = 'scheduled' | 'open' | 'closed'

export interface AdminAssemblyRow {
  id: string
  kind: string
  subjectRef: string
  subjectLabel: string | null
  title: string | null
  status: AssemblyStatus
  opensAt: Date
  closesAt: Date
  effectAppliesAt: Date
  effectAppliedAt: Date | null
  outcome: 'approved' | 'not_approved' | null
  outcomeReason: 'decided' | 'quorum' | 'tie' | null
  voterCount: number | null
  winningOptionId: string | null
  minVoters: number | null
  // Aprovada, com o efeito já devido e ainda não entregue.
  effectPending: boolean
  // Há pausa vigente cobrindo esta assembleia.
  paused: boolean
}

export interface AdminAssemblyVoteView {
  userId: string
  username: string | null
  name: string | null
  optionId: string
  // Ações na data de corte; nulo se a pessoa não era elegível (o voto é descartado na apuração).
  weight: number | null
  eligible: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AdminAssemblyDetailView {
  assembly: AdminAssemblyRow
  options: Array<{
    id: string
    key: string
    label: string
    gain: string
    loss: string
    effect: { metric: 'growth' | 'quality'; direction: 1 | -1; intensity: number } | null
    position: number
    voters: number
    weight: number
  }>
  minVoters: number
  countedVoters: number
  holders: number
  votes: AdminAssemblyVoteView[]
}

export interface AssemblyPauseView {
  id: string
  scope: 'global' | 'subject'
  kind: string | null
  subjectRef: string | null
  reason: string
  createdBy: string
  createdAt: Date
  liftedAt: Date | null
  liftedBy: string | null
}

export interface AssemblyPauseListing {
  active: AssemblyPauseView[]
  recent: AssemblyPauseView[]
}

export interface PauseAssembliesInput {
  scope: 'global' | 'subject'
  // Empresa pausada (escopo `subject`).
  subjectRef?: string
  reason: string
}

export interface AssemblySettingRow {
  key: string
  value: number
  default: number
  min: number
  max: number
  overridden: boolean
  updatedBy: string | null
  updatedAt: Date | null
}

export interface AgendaTemplateOptionView {
  key: string
  label: string
  gain: string
  loss: string
  // { metric, direction, intensity }; o módulo dono valida o formato e a faixa.
  effect: Record<string, unknown>
}

export interface AgendaTemplateContent {
  sector: string | null
  title: string
  description: string
  options: AgendaTemplateOptionView[]
}

export interface AgendaTemplateAdminItem extends AgendaTemplateContent {
  key: string
  active: boolean
  createdAt: Date
  usage: { assemblies: number; activeProposals: number }
}

export interface AssemblyAdmin {
  listAssemblies(status?: AssemblyStatus): Promise<AdminAssemblyRow[]>
  getAssembly(id: string): Promise<AdminAssemblyDetailView>
  listPauses(): Promise<AssemblyPauseListing>
  pause(adminId: string, input: PauseAssembliesInput): Promise<AssemblyPauseView>
  lift(adminId: string, pauseId: string): Promise<AssemblyPauseView>
  listSettings(): Promise<AssemblySettingRow[]>
  setSetting(adminId: string, key: string, value: number): Promise<AssemblySettingRow[]>
  resetSetting(adminId: string, key: string): Promise<AssemblySettingRow[]>
  listTemplates(): Promise<AgendaTemplateAdminItem[]>
  createTemplate(key: string, content: AgendaTemplateContent): Promise<AgendaTemplateAdminItem>
  updateTemplate(key: string, content: AgendaTemplateContent): Promise<AgendaTemplateAdminItem>
  setTemplateActive(key: string, active: boolean): Promise<AgendaTemplateAdminItem>
}
