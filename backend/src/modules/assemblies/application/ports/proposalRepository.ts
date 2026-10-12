import type { AgendaProposal } from '../../domain/proposals'

export interface ProposeInput {
  kind: string
  subjectRef: string
  templateKey: string
  userId: string
  now: Date
  expiresAt: Date
  // Mês de calendário em que a proposta conta para o teto.
  monthFrom: Date
  monthTo: Date
  monthlyCap: number
}

export type ProposeResult =
  | { status: 'created'; proposal: AgendaProposal }
  // Já havia proposta ativa desta pauta nesta empresa: ela não gasta o teto e vira apoio.
  | { status: 'existing'; proposal: AgendaProposal }
  | { status: 'cap_reached' }

export type AddSupportResult = 'added' | 'already' | 'not_active'

export interface ProposalRepository {
  // Cria a proposta com o proponente como primeiro apoio, tudo numa transação que serializa a
  // pauta da empresa e a pessoa no mês (sem corrida no duplicado nem no teto). Expira antes as
  // vencidas da mesma pauta.
  propose(input: ProposeInput): Promise<ProposeResult>
  findById(id: string, viewerId?: string): Promise<AgendaProposal | null>
  // Registra o apoio (idempotente); só vale enquanto a proposta está ativa e dentro do prazo.
  addSupport(proposalId: string, userId: string, now: Date): Promise<AddSupportResult>
  // Retira o apoio; `false` se a pessoa não apoiava. A proposta nunca some por isso.
  removeSupport(proposalId: string, userId: string): Promise<boolean>
  // Propostas ativas e dentro do prazo de uma empresa, com a contagem de apoios.
  listActive(
    kind: string,
    subjectRef: string,
    now: Date,
    viewerId?: string,
  ): Promise<AgendaProposal[]>
  // Propostas criadas pela pessoa no intervalo [from, to), qualquer que seja o estado.
  countProposedBy(userId: string, from: Date, to: Date): Promise<number>
  // Consome a proposta ativa desta pauta nesta empresa (a assembleia a usou). Idempotente.
  consumeActive(
    kind: string,
    subjectRef: string,
    templateKey: string,
    assemblyId: string,
    now: Date,
  ): Promise<boolean>
  // Marca como expiradas as ativas com prazo vencido; devolve quantas.
  expireDue(now: Date): Promise<number>
}
