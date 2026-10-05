import {
  LessonLockedError,
  CheckpointUnsolvedError,
  MicroDecisionUnsolvedError,
  LessonNotFoundError,
  LessonStepOutOfOrderError,
  LessonStepTooFastError,
} from '../../domain/errors'
import {
  LESSON_MIN_STEP_INTERVAL_MS,
  LESSON_UNLOCK_STEP,
  LESSON_XP_REWARD,
  buildProgression,
  completedTrackNumbers,
  type LessonSummary,
} from '../../domain/lesson'
import { checkpointIdsForStep } from '../../domain/widgets/lessonBlocks'
import type { LessonProgressRecord, LessonRepository } from '../ports/lessonRepository'
import type { SocialFeedRecorder } from '../ports/socialFeedRecorder'
import type { StreakTracker } from '../ports/streakTracker'
import type { UnlockedAchievement, XpAwarder } from '../ports/xpAwarder'

export interface AdvanceLessonInput {
  userId: string
  lessonId: string
  step: number
  // DEPRECADO (RC.2.3): a escolha da pergunta vai em `AnswerMicroDecisionUseCase`.
  // Aceito e ignorado, pra cliente antigo não quebrar; nunca devolve veredito
  // aqui (devolver entregaria o gabarito sem exigir o acerto).
  selectedOption?: number
}

export interface AdvanceLessonResult {
  currentStep: number
  completed: boolean
  // Presentes só quando esta chamada é quem conclui a lição pela primeira
  // vez (`completingNow` abaixo) — aditivos ao contrato já existente
  // (tarefa I.2 do backlog de engajamento, pro "teatro de recompensa" da
  // I.1 disparar em tempo real, sem precisar de um segundo round-trip).
  xpAwarded?: number
  leveledUp?: boolean
  // Nível após este crédito (tarefa T.10) — presente sempre que `leveledUp`
  // é, pra o teatro de recompensa calcular o salário novo
  // (`monthlySalaryForLevel`, T.3) sem round-trip extra.
  newLevel?: number
  streakMilestone?: number | null
  unlockedAchievements?: UnlockedAchievement[]
}

export interface AdvanceLessonOptions {
  minStepIntervalMs?: number
  clock?: () => Date
}

export class AdvanceLessonUseCase {
  private readonly minStepIntervalMs: number
  private readonly clock: () => Date

  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly xpAwarder: XpAwarder,
    private readonly streakTracker: StreakTracker,
    private readonly socialFeedRecorder: SocialFeedRecorder,
    options: AdvanceLessonOptions = {},
  ) {
    this.minStepIntervalMs = options.minStepIntervalMs ?? LESSON_MIN_STEP_INTERVAL_MS
    this.clock = options.clock ?? (() => new Date())
  }

  async execute(input: AdvanceLessonInput): Promise<AdvanceLessonResult> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const { microDecisionOptions } = lesson

    const [allLessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])
    const own = progress.find((p) => p.lessonId === input.lessonId)
    const alreadyCompleted = own?.completedAt != null

    // Reabrir uma lição já concluída (modo revisão, tela 3.2) sempre é
    // permitido, mesmo que a progressão de hoje não a sustentaria mais
    // desbloqueada — só lição nunca antes concluída passa pelo gate de
    // desbloqueio. Lição dispensada (N.24) não é concluída: passa pelo gate
    // normalmente, e como o usuário já está além dela, sempre passa.
    if (!alreadyCompleted && !buildProgression(allLessons, progress).isUnlocked(lesson.id)) {
      throw new LessonLockedError('lição bloqueada')
    }

    // Lição já concluída é só leitura (modo revisão, RC.2.1): nenhuma escrita em
    // `current_step`/`microDecisionSelectedOption`, que corromperia conquistas e
    // missões de acerto. O veredito da escolha ainda é devolvido (função pura,
    // sem estado) pra quem quiser conferir, mas nada é gravado nem creditado.
    if (alreadyCompleted && own) {
      return {
        currentStep: own.currentStep,
        completed: true,
      }
    }

    this.assertStepAllowed(input.step, own)

    // Errar não avança (RC.2.3): sair da Micro-decisão (passo 1) exige a pergunta
    // resolvida em `POST /lessons/:id/answer`. O gate só dispara na transição
    // 1 -> 2, então quem já passou dela (ou concluiu) não é afetado.
    if (
      microDecisionOptions !== null &&
      input.step >= 2 &&
      (own?.currentStep ?? 0) < 2 &&
      !own?.microDecisionSolvedAt
    ) {
      throw new MicroDecisionUnsolvedError('responda a pergunta corretamente pra continuar')
    }

    // Perguntas intermediárias (RC.3.2): sair de uma fase exige resolver as
    // `check` dela. Mesmo critério do gate acima: só na transição de fato
    // (quem já passou da fase, ou reenvia o passo gravado, não é afetado).
    if ((own?.currentStep ?? 0) < input.step) {
      const required = checkpointIdsForStep(lesson.blocks, input.step - 1)
      if (required.length > 0) {
        const records = await this.lessonRepository.listCheckpointsForUser(
          input.userId,
          input.lessonId,
        )
        const solved = new Set(
          records.filter((r) => r.solvedAt !== null).map((r) => r.checkpointId),
        )
        if (required.some((id) => !solved.has(id))) {
          throw new CheckpointUnsolvedError('responda as perguntas corretamente pra continuar')
        }
      }
    }

    const attemptingCompletion = !alreadyCompleted && input.step >= LESSON_UNLOCK_STEP

    if (!attemptingCompletion) {
      const saved = await this.lessonRepository.upsertProgress(input.userId, input.lessonId, {
        currentStep: input.step,
        completedAt: alreadyCompleted ? (own?.completedAt ?? null) : null,
      })
      return {
        currentStep: saved.currentStep,
        completed: saved.completedAt !== null,
      }
    }

    // Transição pra concluída é atômica no repositório (`wonRace`) — evita
    // que duas requisições concorrentes (double-tap, duas abas) que ambas
    // leram `alreadyCompleted = false` acima creditem xp/streak/trilha em
    // dobro; só quem de fato transiciona `completedAt` de nulo pra setado
    // segue pro crédito abaixo.
    const completion = await this.lessonRepository.completeIfNotAlreadyCompleted(
      input.userId,
      input.lessonId,
      input.step,
      this.clock(),
    )

    if (!completion.wonRace) {
      return {
        currentStep: completion.record.currentStep,
        completed: true,
      }
    }

    const saved = completion.record
    // `award`/`touch` ficam sequenciais de propósito, não `Promise.all`: cada
    // um chama `achievementChecker.checkAndUnlock` por baixo (efeito próprio
    // de `AwardXpUseCase`/`TouchStreakUseCase`), que lê "conquistas já
    // desbloqueadas" antes de escrever — rodando em paralelo, os dois podem
    // ler o mesmo estado "ainda não desbloqueada" e cada um devolver a mesma
    // conquista como recém-desbloqueada, duplicando o teatro de recompensa
    // (a escrita em si é protegida por `onConflictDoNothing`, o resultado
    // devolvido pra I.1 não).
    // Chave por `lesson.id` (não `lesson.code`, desde a M.6/achado 010):
    // `code` virou mutável (reflete só posição didática atual), então usá-lo
    // aqui reabriria a mesma lição pra reconceder XP se uma renumeração
    // futura mudasse o `code` de uma lição já concluída. `id` nunca muda.
    const xpResult = await this.xpAwarder.award(
      input.userId,
      LESSON_XP_REWARD,
      `licao:${lesson.id}`,
    )
    const streakResult = await this.streakTracker.touch(input.userId)
    await this.recordTrackCompletionIfJustFinished(
      input.userId,
      allLessons,
      lesson.id,
      lesson.trackNumber,
      progress,
      saved.completedAt,
    )

    return {
      currentStep: saved.currentStep,
      completed: saved.completedAt !== null,
      xpAwarded: LESSON_XP_REWARD,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.level,
      streakMilestone: streakResult.milestoneReached,
      unlockedAchievements: [
        ...xpResult.unlockedAchievements,
        ...streakResult.unlockedAchievements,
      ],
    }
  }

  // Gate de passos (S.4/achado 020) — só pra lição ainda não concluída
  // (reabrir uma concluída, modo revisão, nunca passa por aqui). `step` só
  // pode ser o passo gravado (reenvio, ex: trocar a aposta) ou o próximo, e
  // o avanço pro próximo exige `minStepIntervalMs` desde a última gravação.
  // Sem linha ainda, o passo gravado é 0 e não há instante de referência: o
  // primeiro avanço nunca espera (o frontend só chama `progress` ao sair do
  // passo 0, então não existe "início da lição" no servidor).
  private assertStepAllowed(step: number, own: LessonProgressRecord | undefined): void {
    const currentStep = own?.currentStep ?? 0
    if (step !== currentStep && step !== currentStep + 1) {
      throw new LessonStepOutOfOrderError('passo fora de ordem')
    }
    if (step === currentStep + 1 && own) {
      const elapsedMs = this.clock().getTime() - own.updatedAt.getTime()
      if (elapsedMs < this.minStepIntervalMs) {
        throw new LessonStepTooFastError('avanço rápido demais', this.minStepIntervalMs - elapsedMs)
      }
    }
  }

  // Detecta "esta conclusão terminou a trilha" comparando o conjunto de
  // trilhas completas antes/depois desta escrita, em vez de checar "é a
  // última lição por sortOrder" (evitaria carregar `listAll()` sempre, mas
  // duplicaria a regra de "trilha completa" já em `completedTrackNumbers`,
  // reaproveitada por `GetCompletedTracksUseCase`/F.2).
  private async recordTrackCompletionIfJustFinished(
    userId: string,
    allLessons: LessonSummary[],
    lessonId: string,
    trackNumber: number,
    progressBeforeWrite: LessonProgressRecord[],
    newCompletedAt: Date | null,
  ): Promise<void> {
    const waivedAtByLessonId = new Map(progressBeforeWrite.map((p) => [p.lessonId, p.waivedAt]))
    const completedAtByLessonIdBefore = new Map(
      progressBeforeWrite.map((p) => [p.lessonId, p.completedAt]),
    )
    // Mapa "depois" derivado por cópia, não por mutar o "antes" in-place —
    // as duas linhas de `completedTrackNumbers` abaixo ficam independentes
    // uma da outra, sem depender da ordem em que são chamadas (achado da
    // revisão da PR 17: a versão anterior mutava o mesmo Map entre as duas
    // chamadas).
    const completedAtByLessonIdAfter = new Map(completedAtByLessonIdBefore).set(
      lessonId,
      newCompletedAt,
    )
    const toTrackProgress = (completedAtByLessonId: Map<string, Date | null>) =>
      allLessons.map((l) => ({
        trackNumber: l.trackNumber,
        completedAt: completedAtByLessonId.get(l.id) ?? null,
        waivedAt: waivedAtByLessonId.get(l.id) ?? null,
      }))

    const tracksBefore = new Set(
      completedTrackNumbers(toTrackProgress(completedAtByLessonIdBefore)),
    )
    const tracksAfter = completedTrackNumbers(toTrackProgress(completedAtByLessonIdAfter))

    if (tracksAfter.includes(trackNumber) && !tracksBefore.has(trackNumber)) {
      await this.socialFeedRecorder.recordTrackCompleted(userId, trackNumber)
    }
  }
}
