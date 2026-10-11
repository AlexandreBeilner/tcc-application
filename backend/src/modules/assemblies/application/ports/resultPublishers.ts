import type { AssemblyOutcome, AssemblyOutcomeReason } from '../../domain/assembly'

// O que quem publica o resultado precisa saber da assembleia. Nunca carrega voto por pessoa nem
// valor em reais (RNF09): só o desfecho e o contexto de exibição.
export interface AssemblyResultSummary {
  assemblyId: string
  subjectLabel: string
  title: string
  outcome: AssemblyOutcome
  reason: AssemblyOutcomeReason
  // Rótulo da opção vencedora; nulo quando a pauta não passou.
  winningLabel: string | null
}

// Item no feed social de quem participou (os amigos o veem). Idempotente por assembleia e pessoa.
export interface ResultFeed {
  publishParticipation(userId: string, result: AssemblyResultSummary): Promise<void>
}

// E-mail opt-in do resultado para um acionista da data de corte. Idempotente por assembleia e
// pessoa; quem não ligou o e-mail social simplesmente não recebe.
export interface ResultMailer {
  sendResult(userId: string, result: AssemblyResultSummary): Promise<void>
}

// Concede o XP de participação (valor e motivo ficam no adapter, nunca no caso de uso).
export interface ParticipationRewards {
  rewardFirstVote(userId: string, assemblyId: string): Promise<void>
}
