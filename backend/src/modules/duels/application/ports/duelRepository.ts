import type { Duel, DuelDecision } from '../../domain/duel'

export interface NewDuel {
  challengerId: string
  opponentId: string
  now: Date
  expiresAt: Date
}

export interface DuelResult extends DuelDecision {
  challengerPct: number
  opponentPct: number
  challengerOperated: boolean
  opponentOperated: boolean
}

export interface DuelRepository {
  // Cria o desafio se a pessoa ainda tem vaga (transação que trava quem desafia). `null` se não.
  createIfRoom(input: NewDuel, maxSlots: number): Promise<Duel | null>
  findById(id: string): Promise<Duel | null>
  // Duelo aberto (aguardando ou em andamento) entre as duas pessoas, em qualquer direção.
  findOpenBetween(userAId: string, userBId: string): Promise<Duel | null>
  // Mais recentes primeiro.
  listForUser(userId: string, limit: number): Promise<Duel[]>
  // Aceita se o convidado ainda tem vaga (trava o convidado). `'full'` sem vaga; `'gone'` se o
  // duelo já não estava aguardando.
  acceptIfRoom(
    id: string,
    opponentId: string,
    startsAt: Date,
    endsAt: Date,
    maxSlots: number,
  ): Promise<'accepted' | 'full' | 'gone'>
  // Transições condicionais ao estado: devolvem `false` se outro processo já mudou o duelo.
  decline(id: string, at: Date): Promise<boolean>
  cancel(id: string, at: Date): Promise<boolean>
  expire(id: string, at: Date): Promise<boolean>
  finish(id: string, result: DuelResult, at: Date): Promise<boolean>
  listDueActive(now: Date): Promise<Duel[]>
  listExpiredPending(now: Date): Promise<Duel[]>
  listFinishedWithoutXp(limit: number): Promise<Duel[]>
  markXpAwarded(id: string, at: Date): Promise<void>
}
