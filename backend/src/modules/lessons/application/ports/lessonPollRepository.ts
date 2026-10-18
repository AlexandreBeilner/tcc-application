import type { OptionCount } from '../../domain/poll'

// Votos das enquetes das lições (LJ.2.6). Um voto por pessoa e enquete.
export interface LessonPollRepository {
  // Grava o voto e devolve a opção que ficou valendo. Se a pessoa já tinha votado, o primeiro voto
  // permanece (idempotente: duplo clique e reenvio devolvem o mesmo), sem erro.
  castVote(input: {
    userId: string
    lessonId: string
    pollId: string
    option: number
  }): Promise<number>
  // Votos da pessoa nas enquetes da lição.
  listVotesForUser(userId: string, lessonId: string): Promise<{ pollId: string; option: number }[]>
  // Contagem agregada por opção. Nunca expõe quem votou.
  tally(lessonId: string, pollId: string): Promise<OptionCount[]>
}
