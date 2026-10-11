import type {
  AgendaOption,
  Assembly,
  AssemblyOutcome,
  AssemblyOutcomeReason,
  AssemblyStatus,
  NewAssemblyInput,
  Vote,
} from '../../domain/assembly'

export interface AssemblyWithOptions {
  assembly: Assembly
  options: AgendaOption[]
}

export interface AssemblyDecision {
  outcome: AssemblyOutcome
  reason: AssemblyOutcomeReason
  winningOptionId: string | null
  voterCount: number
  decidedAt: Date
}

export type CastVoteResult =
  | { status: 'cast'; changed: boolean; creditConsumed: boolean }
  | { status: 'closed' }
  | { status: 'no_credit' }

export interface AssemblyRepository {
  // Cria assembleia e opções numa transação. Idempotente pelo `dedupeKey`: se já existe, devolve a
  // existente com `created: false` (reexecutar o job de abertura não duplica).
  create(input: NewAssemblyInput, now: Date): Promise<AssemblyWithOptions & { created: boolean }>
  findById(id: string): Promise<AssemblyWithOptions | null>
  listByStatus(status: AssemblyStatus, limit: number): Promise<Assembly[]>
  // Leitura pública: abertas (as que fecham primeiro vêm antes) ou encerradas (as mais recentes
  // primeiro), opcionalmente de uma só empresa. Assembleia ainda `scheduled` nunca é pública.
  listPublic(filter: {
    status: 'open' | 'closed'
    subjectRef?: string
    limit: number
  }): Promise<Assembly[]>
  // Abertas cujo fechamento já passou (candidatas à apuração), as mais antigas primeiro.
  listOpenDue(now: Date, limit: number): Promise<Assembly[]>
  // Assembleias já abertas com algum marco (abertura, fechamento ou efeito) dentro da janela, para o
  // Calendário de mercado.
  listForCalendar(from: Date, to: Date): Promise<Assembly[]>
  // Fechadas e aprovadas, com o efeito já devido e ainda não entregue ao motor.
  listApprovedPendingEffect(now: Date, limit: number): Promise<AssemblyWithOptions[]>
  // Marca o efeito como entregue (condicional: `false` se já estava marcado).
  markEffectApplied(id: string, now: Date): Promise<boolean>
  // Transições condicionais ao estado: `false` se outro processo já mudou a assembleia.
  markOpen(id: string): Promise<boolean>
  close(id: string, decision: AssemblyDecision): Promise<boolean>
  // Grava ou troca o voto, só se a assembleia está aberta na hora da gravação (trava a linha para
  // não perder a corrida contra o fechamento). `false` se estava fora da janela.
  upsertVote(
    input: { assemblyId: string; userId: string; optionId: string },
    now: Date,
  ): Promise<boolean>
  listVotes(assemblyId: string): Promise<Vote[]>
  findVote(assemblyId: string, userId: string): Promise<Vote | null>
  // Grava ou troca o voto e, quando `credit` vem, consome o crédito do mês, tudo numa transação:
  // trava a assembleia (voto e fechamento se serializam) e a pessoa no mês (dois votos simultâneos
  // em assembleias diferentes não gastam o mesmo crédito). Quem já tem voto nesta assembleia nunca
  // consome crédito de novo. `closed`: fora da janela; `no_credit`: saldo do mês esgotado. Nada é
  // gravado nesses dois casos (o crédito não se perde).
  castVote(
    input: {
      assemblyId: string
      userId: string
      optionId: string
      credit?: { monthKey: string; monthlyFreeCredits: number }
    },
    now: Date,
  ): Promise<CastVoteResult>
  // Créditos gratuitos já consumidos pela pessoa no mês de calendário (`monthKey`).
  countCreditsUsed(userId: string, monthKey: string): Promise<number>
  // Registra o consumo (idempotente por pessoa e assembleia).
  consumeCredit(
    input: { userId: string; assemblyId: string; monthKey: string },
    now: Date,
  ): Promise<void>
}
