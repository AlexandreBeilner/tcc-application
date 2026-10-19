import type { DailyPuzzle, DailyQuestion, DailyWord } from '../../domain/content'
import {
  DEFAULT_WINDOWS,
  planDay,
  windowDates,
  type AgendaWarningCode,
  type AgendaWindows,
  type ScheduledDay,
} from '../../domain/agenda'
import { addDays, dailyDay, gameNumberFor, resolveStatus } from '../../domain/gameDay'
import type { DailyEventRepository } from '../ports/dailyEventRepository'
import type { DailyPuzzleRepository } from '../ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from '../ports/dailyQuestionRepository'
import type { DailySettingsRepository } from '../ports/dailySettingsRepository'
import type { DailyWordRepository } from '../ports/dailyWordRepository'

export const DEFAULT_HORIZON_DAYS = 30

// Cobre a maior janela de não repetição, para o histórico enxergar o que já foi usado.
const HISTORY_LIMIT = 2000

export interface AgendaWarning {
  date: string
  code: AgendaWarningCode | 'published_misaligned'
}

export interface MaterializeResult {
  status: 'off' | 'scheduled' | 'live'
  created: number[]
  // Jogos não publicados antes da estreia, descartados ao mudar a data.
  removed: number
  renumbered: number
  warnings: AgendaWarning[]
}

export interface MaterializeOptions {
  horizonDays?: number
  windows?: AgendaWindows
}

// Garante jogos materializados para os próximos N dias: a partir da estreia enquanto o Diário está
// agendado, a partir de hoje depois que está no ar. Sem etapa de revisão, o jogo
// materializado já nasce publicado (só o rascunho de estreia espera o admin agendar). Idempotente: dia que já tem jogo não é tocado, e jogo publicado nunca
// é regenerado. Mudar a estreia enquanto agendada é absorvido aqui: a cada execução os jogos não
// publicados são realinhados (renumerados, ou descartados se ficaram antes da estreia). Banco sem conteúdo suficiente gera aviso para o dia, nunca um jogo quebrado.
export class MaterializeUpcomingPuzzlesUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
    private readonly events: DailyEventRepository,
    private readonly puzzles: DailyPuzzleRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly options: MaterializeOptions = {},
  ) {}

  // `draftStartDate`: o painel prepara o rascunho de uma estreia que ainda não foi agendada (sem
  // jogo pronto não há como agendar, e sem agendar a agenda não materializa). Só para uma data
  // futura; no ar, vale sempre a data gravada.
  async execute(draftStartDate?: string): Promise<MaterializeResult> {
    const startDate = draftStartDate ?? (await this.settings.get()).startDate
    const now = this.now()
    const today = dailyDay(now)
    const state = resolveStatus(startDate, today)
    const result: MaterializeResult = {
      status: state.status,
      created: [],
      removed: 0,
      renumbered: 0,
      warnings: [],
    }
    if (state.status === 'off') return result

    const windows = this.options.windows ?? DEFAULT_WINDOWS
    const horizon = this.options.horizonDays ?? DEFAULT_HORIZON_DAYS
    const windowStart = state.status === 'scheduled' ? state.startDate : today
    const historyFrom = addDays(
      windowStart < today ? windowStart : today,
      -(Math.max(windows.wordDays, windows.questionDays) + 1),
    )

    const existing = await this.puzzles.listFromDate(historyFrom, HISTORY_LIMIT)
    const kept = await this.realign(existing, state.startDate, result)

    const [activeWords, activeQuestions, activeEvents] = await Promise.all([
      this.words.listActive(),
      this.questions.listActive(),
      this.events.listActive(),
    ])
    const history = await this.buildHistory(kept, activeWords, activeQuestions)
    const takenDates = new Set(kept.map((p) => p.gameDate))
    const takenNumbers = new Set(kept.map((p) => p.number))

    for (const date of windowDates(windowStart, horizon)) {
      if (takenDates.has(date)) continue
      // Número ocupado por um jogo publicado desalinhado: não colide, só avisa (o admin resolve).
      if (takenNumbers.has(gameNumberFor(state.startDate, date) as number)) {
        result.warnings.push({ date, code: 'published_misaligned' })
        continue
      }
      const { plan, warnings } = planDay({
        date,
        words: activeWords,
        questions: activeQuestions,
        events: activeEvents,
        history,
        windows,
      })
      for (const code of warnings) result.warnings.push({ date, code })
      if (!plan) continue

      const number = gameNumberFor(state.startDate, date) as number
      await this.puzzles.create({
        number,
        gameDate: date,
        ...plan,
        wordOrigin: 'generated',
        questionOrigin: 'generated',
        timelineOrigin: 'generated',
        reviewedBy: null,
        reviewedAt: null,
        // Sem etapa de revisão, o jogo nasce no ar. O rascunho de estreia é a exceção: só vai ao ar
        // quando o admin agenda (`SetStartDateUseCase` publica em lote).
        publishedAt: draftStartDate === undefined ? now : null,
      })
      result.created.push(number)
      const word = activeWords.find((w) => w.id === plan.wordId)
      const question = activeQuestions.find((q) => q.id === plan.questionId)
      history.push({
        date,
        wordId: plan.wordId,
        wordCategory: word?.category ?? null,
        wordScope: word?.scope ?? null,
        questionId: plan.questionId,
        questionCategory: question?.category ?? null,
        questionScope: question?.scope ?? null,
        timelineEventIds: plan.timelineEventIds,
      })
    }
    // No ar, nenhum dia materializado de hoje em diante fica fora: o jogador veria "indisponível".
    if (state.status === 'live' && draftStartDate === undefined) {
      await this.puzzles.publishPending(today, now)
    }
    return result
  }

  // Jogo não publicado antes da estreia sai; o de data válida com número errado é renumerado.
  // Jogo publicado nunca muda (se estiver desalinhado, só avisa).
  private async realign(
    existing: DailyPuzzle[],
    startDate: string,
    result: MaterializeResult,
  ): Promise<DailyPuzzle[]> {
    const kept: DailyPuzzle[] = []
    let changed = false
    for (const puzzle of existing) {
      const expected = gameNumberFor(startDate, puzzle.gameDate)
      if (puzzle.publishedAt !== null) {
        if (expected !== puzzle.number)
          result.warnings.push({ date: puzzle.gameDate, code: 'published_misaligned' })
        kept.push(puzzle)
      } else if (expected === null) {
        result.removed++
        changed = true
      } else if (expected !== puzzle.number) {
        result.renumbered++
        changed = true
        kept.push({ ...puzzle, number: expected })
      } else {
        kept.push(puzzle)
      }
    }
    if (changed) await this.puzzles.replaceUnpublished(kept.filter((p) => p.publishedAt === null))
    return kept
  }

  private async buildHistory(
    puzzles: DailyPuzzle[],
    words: DailyWord[],
    questions: DailyQuestion[],
  ): Promise<ScheduledDay[]> {
    const wordById = new Map(words.map((w) => [w.id, w]))
    const questionById = new Map(questions.map((q) => [q.id, q]))
    const missing = [...new Set(puzzles.map((p) => p.questionId))].filter(
      (id) => !questionById.has(id),
    )
    for (const question of await this.questions.findManyByIds(missing)) {
      questionById.set(question.id, question)
    }

    return puzzles.map((p) => ({
      date: p.gameDate,
      wordId: p.wordId,
      wordCategory: wordById.get(p.wordId)?.category ?? null,
      wordScope: wordById.get(p.wordId)?.scope ?? null,
      questionId: p.questionId,
      questionCategory: questionById.get(p.questionId)?.category ?? null,
      questionScope: questionById.get(p.questionId)?.scope ?? null,
      timelineEventIds: p.timelineEventIds,
    }))
  }
}
