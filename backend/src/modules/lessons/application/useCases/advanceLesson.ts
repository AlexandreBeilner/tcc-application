import {
  InvalidMicroDecisionOptionError,
  LessonLockedError,
  LessonNotFoundError,
  LessonStepOutOfOrderError,
  LessonStepTooFastError,
} from '../../domain/errors'
import {
  LESSON_MIN_STEP_INTERVAL_MS,
  LESSON_UNLOCK_STEP,
  LESSON_XP_REWARD,
  completedTrackNumbers,
  isUnlocked,
  microDecisionResultFor,
} from '../../domain/lesson'
import type { LessonProgressRecord, LessonRepository } from '../ports/lessonRepository'
import type { SocialFeedRecorder } from '../ports/socialFeedRecorder'
import type { StreakTracker } from '../ports/streakTracker'
import type { UnlockedAchievement, XpAwarder } from '../ports/xpAwarder'

export interface AdvanceLessonInput {
  userId: string
  lessonId: string
  step: number
  // Aposta com acerto/erro real (backlog engajamento B.2) — só faz sentido
  // pra lição com `microDecisionOptions` preenchido (B.1); ignorado sem erro
  // pra lição sem aposta real (checkbox de hoje continua valendo).
  selectedOption?: number
}

export interface AdvanceLessonResult {
  currentStep: number
  completed: boolean
  // Presente só quando esta chamada incluiu `selectedOption` válido pra uma
  // lição com aposta real (correção da revisão da PR 18) — o índice certo
  // (`microDecisionCorrectOption`) nunca é devolvido por `GET /lessons`/
  // `GET /lessons/:id` de antemão (`domain/lesson.buildLessonView`), só o
  // veredito desta escolha, na resposta do `POST` que a fez.
  microDecisionCorrect?: boolean
  correctOptionLabel?: string
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

    // Índice validado contra o tamanho real de `microDecisionOptions` desta
    // lição — Zod (schemas.ts) só garante que é um inteiro >= 0, não que
    // cabe nas opções de uma lição específica (isso é regra de negócio, não
    // formato de payload). Lição sem opções reais nunca lança aqui: o campo
    // simplesmente não se aplica (checkbox de hoje continua valendo).
    const { microDecisionOptions } = lesson
    if (
      input.selectedOption !== undefined &&
      microDecisionOptions !== null &&
      input.selectedOption >= microDecisionOptions.length
    ) {
      throw new InvalidMicroDecisionOptionError('opção de micro-decisão inválida')
    }

    // Calculado uma vez, reaproveitado nos 3 `return` abaixo — o veredito
    // não depende de qual caminho a chamada segue (grava passo, conclui, ou
    // perde a corrida de conclusão pra outra requisição concorrente), só de
    // `selectedOption` ter vindo válido nesta chamada.
    const microDecisionResult = microDecisionResultFor(lesson, input.selectedOption)
    const microDecisionFields = microDecisionResult
      ? {
          microDecisionCorrect: microDecisionResult.correct,
          correctOptionLabel: microDecisionResult.correctOptionLabel,
        }
      : {}

    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    const completedCount = progress.filter((p) => p.completedAt !== null).length
    const own = progress.find((p) => p.lessonId === input.lessonId)
    const alreadyCompleted = own?.completedAt != null

    // Reabrir uma lição já concluída (modo revisão, tela 3.2) sempre é
    // permitido, mesmo que a contagem global de concluídas hoje não a
    // sustentaria mais desbloqueada — só lição nunca antes concluída passa
    // pelo gate de desbloqueio.
    if (!alreadyCompleted && !isUnlocked(lesson.sortOrder, completedCount)) {
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
        ...microDecisionFields,
      }
    }

    this.assertStepAllowed(input.step, own)

    const attemptingCompletion = !alreadyCompleted && input.step >= LESSON_UNLOCK_STEP

    if (!attemptingCompletion) {
      const saved = await this.lessonRepository.upsertProgress(input.userId, input.lessonId, {
        currentStep: input.step,
        completedAt: alreadyCompleted ? (own?.completedAt ?? null) : null,
        // `undefined` (nunca `null`) quando a lição não tem aposta real —
        // `UpsertProgressInput.microDecisionSelectedOption` trata ausência
        // como "não mexe no valor já gravado" (B.1), então isto nunca apaga
        // uma escolha feita numa chamada anterior por engano.
        ...(input.selectedOption !== undefined && microDecisionOptions !== null
          ? { microDecisionSelectedOption: input.selectedOption }
          : {}),
      })
      return {
        currentStep: saved.currentStep,
        completed: saved.completedAt !== null,
        ...microDecisionFields,
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
      // Mesma condição de `upsertProgress` acima — a escolha só entra quando
      // a lição de fato tem aposta real, pra não persistir um índice de
      // lição que não tem `microDecisionOptions`.
      input.selectedOption !== undefined && microDecisionOptions !== null
        ? input.selectedOption
        : undefined,
    )

    if (!completion.wonRace) {
      return {
        currentStep: completion.record.currentStep,
        completed: true,
        ...microDecisionFields,
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
      lesson.id,
      lesson.trackNumber,
      progress,
      saved.completedAt,
    )

    return {
      currentStep: saved.currentStep,
      completed: saved.completedAt !== null,
      ...microDecisionFields,
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
    lessonId: string,
    trackNumber: number,
    progressBeforeWrite: LessonProgressRecord[],
    newCompletedAt: Date | null,
  ): Promise<void> {
    const allLessons = await this.lessonRepository.listAll()
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
