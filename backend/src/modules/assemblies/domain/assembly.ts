// Núcleo genérico das assembleias (MO.6.1). Nada aqui conhece um `kind` específico: o que muda
// de um tipo para outro (quem pode votar, quanto vale o voto, o que o resultado faz) entra por
// `KindPolicies` e pelo `EffectApplier` do registro em `application/`.
import { AssemblyNotOpenError, InvalidAssemblyError, InvalidAssemblyOptionError } from './errors'

export type AssemblyKind = string
// scheduled: criada, ainda não aberta; open: recebendo votos; closed: apurada.
export type AssemblyStatus = 'scheduled' | 'open' | 'closed'
export type AssemblyOutcome = 'approved' | 'not_approved'
// decided: uma opção venceu; quorum: poucos votantes; tie: empate no topo (status quo).
export type AssemblyOutcomeReason = 'decided' | 'quorum' | 'tie'

export interface Assembly {
  id: string
  kind: AssemblyKind
  // Sobre o que se decide: a empresa (`shareholder`) ou o mercado inteiro em kinds futuros.
  subjectRef: string
  dedupeKey: string
  status: AssemblyStatus
  opensAt: Date
  // Data de corte: o snapshot de posições é medido nesse instante.
  snapshotAt: Date
  closesAt: Date
  effectAppliesAt: Date
  outcome: AssemblyOutcome | null
  outcomeReason: AssemblyOutcomeReason | null
  winningOptionId: string | null
  voterCount: number | null
  decidedAt: Date | null
  // Contexto de exibição (nulos em assembleias criadas sem catálogo).
  title: string | null
  subjectLabel: string | null
  templateKey: string | null
  // Quando o resultado aprovado foi entregue ao motor; nulo = ainda não aplicado.
  effectAppliedAt: Date | null
  // Quando o resultado foi publicado no feed social e por e-mail (MO.6.7); nulo = ainda não.
  resultAnnouncedAt: Date | null
  createdAt: Date
}

export interface AgendaOption {
  id: string
  assemblyId: string
  key: string
  label: string
  // Cada lado da pauta mostra o que ganha e o que perde (sem recomendar um).
  gain: string
  loss: string
  // Parâmetros do efeito, lidos pelo `EffectApplier` do kind.
  effect: Record<string, unknown>
  position: number
}

export interface Vote {
  assemblyId: string
  userId: string
  optionId: string
  createdAt: Date
  updatedAt: Date
}

export interface HoldingPosition {
  userId: string
  quantity: number
}

// Posições na data de corte, só de contas de usuário (o motor já deixa os bots de fora).
export interface HoldingsSnapshot {
  takenAt: Date
  holdings: readonly HoldingPosition[]
}

// Regras por kind que são funções puras. O efeito (que fala com o motor) fica em `application/`.
export interface KindPolicies {
  // Pode participar desta assembleia? (ex.: shareholder exige posição no snapshot.)
  isEligible(userId: string, snapshot: HoldingsSnapshot): boolean
  // Quanto vale o voto (ex.: shareholder = ações na data de corte).
  weightOf(userId: string, snapshot: HoldingsSnapshot): number
}

// Parâmetros editáveis (o painel admin os grava na MO.6.8); nunca valores fixos nas regras.
export interface AssemblyParams {
  // Votantes distintos mínimos para a pauta valer; abaixo disso nada muda.
  minVoters: number
  // Quantos votos gratuitos por mês de calendário quem não é PRO tem.
  monthlyFreeCredits: number
  // Nível mínimo para usar o crédito gratuito (decisão do autor: 3).
  freeCreditMinLevel: number
}

export const DEFAULT_ASSEMBLY_PARAMS: AssemblyParams = {
  minVoters: 3,
  monthlyFreeCredits: 1,
  freeCreditMinLevel: 3,
}

export interface OptionTotal {
  optionId: string
  voters: number
  weight: number
}

export interface Tally {
  voters: number
  totals: OptionTotal[]
  outcome: AssemblyOutcome
  reason: AssemblyOutcomeReason
  // `null` quando a pauta não passa: o status quo continua.
  winningOptionId: string | null
}

export interface NewAssemblyInput {
  kind: AssemblyKind
  subjectRef: string
  dedupeKey: string
  opensAt: Date
  snapshotAt: Date
  closesAt: Date
  effectAppliesAt: Date
  title?: string
  subjectLabel?: string
  templateKey?: string
  options: Array<Omit<AgendaOption, 'id' | 'assemblyId' | 'position'>>
}

// Ordem do ciclo (corte <= abertura < fechamento <= efeito) e pauta válida (2+ opções, chaves únicas).
export function validateNewAssembly(input: NewAssemblyInput): void {
  const { snapshotAt, opensAt, closesAt, effectAppliesAt } = input
  if (!(snapshotAt <= opensAt && opensAt < closesAt && closesAt <= effectAppliesAt)) {
    throw new InvalidAssemblyError('datas fora de ordem')
  }
  if (input.options.length < 2)
    throw new InvalidAssemblyError('a pauta precisa de 2 opções ou mais')
  if (new Set(input.options.map((o) => o.key)).size !== input.options.length) {
    throw new InvalidAssemblyError('chaves de opção repetidas')
  }
}

// Janela de voto: aberta e antes do fechamento. Vale também para trocar o voto.
export function isOpenForVoting(assembly: Assembly, now: Date): boolean {
  return assembly.status === 'open' && now >= assembly.opensAt && now < assembly.closesAt
}

export function assertOpenForVoting(assembly: Assembly, now: Date): void {
  if (!isOpenForVoting(assembly, now)) throw new AssemblyNotOpenError()
}

export function assertOptionBelongs(options: readonly AgendaOption[], optionId: string): void {
  if (!options.some((o) => o.id === optionId)) throw new InvalidAssemblyOptionError()
}

// Primeiro voto de quem ainda não votou? (Só nesse caso o crédito mensal é consumido.)
export function isFirstVote(votes: readonly Vote[], userId: string): boolean {
  return !votes.some((v) => v.userId === userId)
}

// Apuração: o peso de cada voto vem da política do kind sobre o snapshot; quem não é elegível
// (ou tem peso zero) é descartado, mesmo que tenha um voto gravado. Votantes distintos abaixo do
// mínimo, ou empate no topo, mantêm o status quo.
export function tallyVotes(
  options: readonly AgendaOption[],
  votes: readonly Vote[],
  snapshot: HoldingsSnapshot,
  policies: KindPolicies,
  params: Pick<AssemblyParams, 'minVoters'>,
): Tally {
  const totals = new Map<string, OptionTotal>(
    options.map((o) => [o.id, { optionId: o.id, voters: 0, weight: 0 }]),
  )
  let voters = 0
  for (const vote of votes) {
    const total = totals.get(vote.optionId)
    if (!total || !policies.isEligible(vote.userId, snapshot)) continue
    const weight = policies.weightOf(vote.userId, snapshot)
    if (!(weight > 0)) continue
    total.voters += 1
    total.weight += weight
    voters += 1
  }
  const ordered = options.map((o) => totals.get(o.id) as OptionTotal)
  if (voters < params.minVoters) {
    return {
      voters,
      totals: ordered,
      outcome: 'not_approved',
      reason: 'quorum',
      winningOptionId: null,
    }
  }
  const top = Math.max(...ordered.map((t) => t.weight))
  const leaders = ordered.filter((t) => t.weight === top)
  if (leaders.length !== 1) {
    return {
      voters,
      totals: ordered,
      outcome: 'not_approved',
      reason: 'tie',
      winningOptionId: null,
    }
  }
  return {
    voters,
    totals: ordered,
    outcome: 'approved',
    reason: 'decided',
    winningOptionId: leaders[0].optionId,
  }
}

const BRT_OFFSET_HOURS = 3

// Mês de calendário em Brasília ('2026-10'), chave do crédito mensal. Brasília é UTC-3 o ano todo
// (sem horário de verão desde 2019).
export function creditMonthKey(at: Date): string {
  const brt = new Date(at.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000)
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`
}

export function hasFreeCredit(
  usedThisMonth: number,
  params: Pick<AssemblyParams, 'monthlyFreeCredits'>,
): boolean {
  return usedThisMonth < params.monthlyFreeCredits
}
