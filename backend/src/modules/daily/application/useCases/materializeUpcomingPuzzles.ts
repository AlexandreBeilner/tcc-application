import type { DailyFact, DailyPuzzle, DailyWord } from '../../domain/content'
import {
  DEFAULT_WINDOWS,
  planDay,
  windowDates,
  type AgendaWarningCode,
  type AgendaWindows,
  type ScheduledDay,
} from '../../domain/agenda'
import { addDays, dailyDay, gameNumberFor, resolveStatus } from '../../domain/gameDay'
import type { DailyFactRepository } from '../ports/dailyFactRepository'
import type { DailyPuzzleRepository } from '../ports/dailyPuzzleRepository'
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
// agendado, a partir de hoje depois que está no ar. Materializar não é publicar (revisão e
// publicação são do admin). Idempotente: dia que já tem jogo não é tocado, e jogo publicado nunca
// é regenerado. Mudar a estreia enquanto agendada é absorvido aqui: a cada execução os jogos não
// publicados são realinhados (renumerados, ou descartados se ficaram antes da estreia), mantendo a
// revisão. Banco sem conteúdo suficiente gera aviso para o dia, nunca um jogo quebrado.
export class MaterializeUpcomingPuzzlesUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly words: DailyWordRepository,
    private readonly facts: DailyFactRepository,
    private readonly puzzles: DailyPuzzleRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly options: MaterializeOptions = {},
  ) {}

  async execute(): Promise<MaterializeResult> {
    const { startDate } = await this.settings.get()
    const today = dailyDay(this.now())
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
      -(Math.max(windows.wordDays, windows.onThisDayDays) + 1),
    )

    const existing = await this.puzzles.listFromDate(historyFrom, HISTORY_LIMIT)
    const kept = await this.realign(existing, state.startDate, result)

    const [activeWords, activeFacts] = await Promise.all([
      this.words.listActive(),
      this.facts.listActive(),
    ])
    const history = await this.buildHistory(kept, activeWords, activeFacts)
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
        facts: activeFacts,
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
        factOrigin: 'generated',
        timelineOrigin: 'generated',
        reviewedBy: null,
        reviewedAt: null,
        publishedAt: null,
      })
      result.created.push(number)
      const word = activeWords.find((w) => w.id === plan.wordId)
      const fact = activeFacts.find((f) => f.id === plan.factId)
      history.push({
        date,
        wordId: plan.wordId,
        wordCategory: word?.category ?? null,
        wordScope: word?.scope ?? null,
        factId: plan.factId,
        factCategory: fact?.category ?? null,
        factScope: fact?.scope ?? null,
        timelineFactIds: plan.timelineFactIds,
      })
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
    facts: DailyFact[],
  ): Promise<ScheduledDay[]> {
    const wordById = new Map(words.map((w) => [w.id, w]))
    const factById = new Map(facts.map((f) => [f.id, f]))
    const missing = [...new Set(puzzles.map((p) => p.factId))].filter((id) => !factById.has(id))
    for (const fact of await this.facts.findManyByIds(missing)) factById.set(fact.id, fact)

    return puzzles.map((p) => ({
      date: p.gameDate,
      wordId: p.wordId,
      wordCategory: wordById.get(p.wordId)?.category ?? null,
      wordScope: wordById.get(p.wordId)?.scope ?? null,
      factId: p.factId,
      factCategory: factById.get(p.factId)?.category ?? null,
      factScope: factById.get(p.factId)?.scope ?? null,
      timelineFactIds: p.timelineFactIds,
    }))
  }
}
