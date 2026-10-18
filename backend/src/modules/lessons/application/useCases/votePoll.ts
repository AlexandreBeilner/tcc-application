import {
  InvalidPollOptionError,
  LessonLockedError,
  LessonNotFoundError,
  PollNotFoundError,
} from '../../domain/errors'
import { buildProgression } from '../../domain/lesson'
import { buildPollState, isValidPollOption } from '../../domain/poll'
import type { PollState } from '../../domain/poll'
import { findPollBlock } from '../../domain/widgets/lessonBlocks'
import type { LessonPollRepository } from '../ports/lessonPollRepository'
import type { LessonRepository } from '../ports/lessonRepository'

export interface VotePollInput {
  userId: string
  lessonId: string
  pollId: string
  option: number
}

// Voto na enquete de uma lição (LJ.2.6). Não tem resposta certa nem efeito em XP, progresso ou
// placar. Um voto por pessoa e enquete: votar de novo devolve o primeiro voto. Só quem já pode abrir
// a lição vota (lição concluída conta, é assim que a revisão mostra o voto).
export class VotePollUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly polls: LessonPollRepository,
  ) {}

  async execute(input: VotePollInput): Promise<PollState> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    const block = findPollBlock(lesson.blocks, input.pollId)
    if (!block) {
      throw new PollNotFoundError('enquete não encontrada nesta lição')
    }
    if (!isValidPollOption(block, input.option)) {
      throw new InvalidPollOptionError('opção inválida pra esta enquete')
    }

    const [progress, allLessons] = await Promise.all([
      this.lessonRepository.listProgressForUser(input.userId),
      this.lessonRepository.listAll(),
    ])
    const own = progress.find((p) => p.lessonId === input.lessonId)
    if (own?.completedAt == null && !buildProgression(allLessons, progress).isUnlocked(lesson.id)) {
      throw new LessonLockedError('lição bloqueada')
    }

    const vote = await this.polls.castVote({
      userId: input.userId,
      lessonId: input.lessonId,
      pollId: input.pollId,
      option: input.option,
    })
    return buildPollState(block, vote, await this.polls.tally(input.lessonId, input.pollId))
  }
}
