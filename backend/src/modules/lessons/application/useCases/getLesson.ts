import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import {
  buildLessonView,
  buildProgression,
  utcDateString,
  type LessonView,
} from '../../domain/lesson'
import { buildPollState, pollBlocks } from '../../domain/poll'
import type { PollState } from '../../domain/poll'
import { buildRecallView, selectRecall } from '../../domain/recall'
import type { LessonSummary } from '../../domain/lesson'
import type { LessonPollRepository } from '../ports/lessonPollRepository'
import type { LessonProgressRecord, LessonRepository } from '../ports/lessonRepository'

export interface GetLessonInput {
  userId: string
  lessonId: string
}

export class GetLessonUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly polls: LessonPollRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: GetLessonInput): Promise<LessonView> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])
    const own = progress.find((p) => p.lessonId === input.lessonId)
    const checkpoints = await this.lessonRepository.listCheckpointsForUser(
      input.userId,
      input.lessonId,
    )
    const view = buildLessonView(lesson, own, buildProgression(lessons, progress), checkpoints)

    // Lição bloqueada nunca é exposta em detalhe (tela 3.2) — mesmo status
    // 404 de "não encontrada", pra não distinguir "não existe" de
    // "existe mas você não pode ver" (spec 5.1/5.2).
    if (view.status === 'locked') {
      throw new LessonLockedError('lição bloqueada')
    }

    // "Relembra?" (LJ.5.5): só em lição ainda não concluída e ainda no começo. Revisão de lição concluída e
    // lição retomada no meio não ganham a pergunta de abertura.
    const polls = await this.pollsFor(input.userId, lesson)
    const withPolls = polls.length > 0 ? { ...view, polls } : view

    if (view.status === 'available' && view.currentStep === 0) {
      const recall = await this.recallFor(input.userId, lesson, lessons, progress)
      if (recall) {
        return { ...withPolls, recall }
      }
    }

    return withPolls
  }

  // Enquetes (LJ.2.6): só as que a pessoa já votou, com o resultado atual. O resultado de uma enquete
  // ainda não votada nunca sai daqui.
  private async pollsFor(userId: string, lesson: LessonSummary): Promise<PollState[]> {
    const blocks = pollBlocks(lesson.blocks)
    if (blocks.length === 0) {
      return []
    }
    const votes = await this.polls.listVotesForUser(userId, lesson.id)
    const states: PollState[] = []
    for (const block of blocks) {
      const vote = votes.find((v) => v.pollId === block.id)
      if (vote) {
        states.push(buildPollState(block, vote.option, await this.polls.tally(lesson.id, block.id)))
      }
    }
    return states
  }

  private async recallFor(
    userId: string,
    current: LessonSummary,
    lessons: LessonSummary[],
    progress: LessonProgressRecord[],
  ) {
    const completedLessonIds = new Set(
      progress.filter((p) => p.completedAt !== null).map((p) => p.lessonId),
    )
    if (completedLessonIds.size === 0) {
      return undefined
    }
    const choice = selectRecall({
      seed: `${userId}|${utcDateString(this.clock())}`,
      current,
      lessons,
      completedLessonIds,
      checkpoints: await this.lessonRepository.listAllCheckpointsForUser(userId),
    })
    return choice ? buildRecallView(choice, lessons) : undefined
  }
}
