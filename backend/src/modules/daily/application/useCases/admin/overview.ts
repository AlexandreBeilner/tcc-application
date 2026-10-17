import {
  COVERAGE_WINDOW_DAYS,
  LOW_REVIEWED_COVER_DAYS,
  addToTally,
  consecutiveDaysFrom,
  emptyTally,
} from '../../../domain/adminCoverage'
import type { DailyEvent, DailyPuzzle, DailyQuestion, DailyWord } from '../../../domain/content'
import { MIN_CONTENT_DAYS_AHEAD } from '../../../domain/launchSchedule'
import { addDays, dailyDay, resolveStatus } from '../../../domain/gameDay'
import type { AdminAgendaDay, AdminAlertCode, AdminOverview } from '../../adminViews'
import type { AcceptedWordRepository } from '../../ports/acceptedWordRepository'
import type { DailyEventRepository } from '../../ports/dailyEventRepository'
import type { DailyPuzzleRepository } from '../../ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from '../../ports/dailyQuestionRepository'
import type { DailySettingsRepository } from '../../ports/dailySettingsRepository'
import type { DailyWordRepository } from '../../ports/dailyWordRepository'

// Dias de agenda devolvidos: a janela da contagem mais uma folga para o admin ver o que vem depois.
const AGENDA_DAYS = COVERAGE_WINDOW_DAYS + 15

// Tudo que a tela principal do painel precisa numa leitura: estado da estreia, agenda dos próximos
// dias com o que cada cartão traz, contagem por categoria e marcador, e os alertas.
export class GetDailyAdminOverviewUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly puzzles: DailyPuzzleRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
    private readonly events: DailyEventRepository,
    private readonly accepted: AcceptedWordRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<AdminOverview> {
    const today = dailyDay(this.now())
    const { startDate } = await this.settings.get()
    const state = resolveStatus(startDate, today)

    // Agendado: a agenda começa na estreia. Desligado: no primeiro rascunho, se houver.
    const probeFrom = state.status === 'scheduled' ? state.startDate : today
    const found = await this.puzzles.listFromDate(probeFrom, AGENDA_DAYS)
    const agendaFrom = state.status === 'off' && found[0] ? found[0].gameDate : probeFrom
    const puzzles = found.filter((p) => p.gameDate >= agendaFrom)

    const [allWords, allQuestions, allEvents, extra] = await Promise.all([
      this.words.listAll(),
      this.questions.listAll(),
      this.events.listAll(),
      this.accepted.listExtra(),
    ])
    const wordById = new Map(allWords.map((w) => [w.id, w]))
    const questionById = new Map(allQuestions.map((q) => [q.id, q]))
    const eventById = new Map(allEvents.map((e) => [e.id, e]))

    const days = puzzles.map((p) => toDay(p, wordById, questionById, eventById))
    const reviewedDaysAhead = consecutiveDaysFrom(
      agendaFrom,
      puzzles.map((p) => ({ gameDate: p.gameDate, ok: p.reviewedAt !== null })),
    )
    const publishedDaysAhead = consecutiveDaysFrom(
      agendaFrom,
      puzzles.map((p) => ({ gameDate: p.gameDate, ok: p.publishedAt !== null })),
    )

    const alerts: AdminAlertCode[] = []
    if (state.status !== 'off' && reviewedDaysAhead < LOW_REVIEWED_COVER_DAYS) {
      alerts.push('low_reviewed_cover')
    }
    if (state.status === 'scheduled' && reviewedDaysAhead < MIN_CONTENT_DAYS_AHEAD) {
      alerts.push('scheduled_below_minimum')
    }
    if (state.status === 'live' && puzzles[0]?.gameDate !== today)
      alerts.push('today_not_published')
    else if (state.status === 'live' && puzzles[0]?.publishedAt === null) {
      alerts.push('today_not_published')
    }

    return {
      status: state.status,
      startDate,
      today,
      canChangeStart: state.status !== 'live',
      agendaFrom,
      reviewedDaysAhead,
      publishedDaysAhead,
      minDaysToSchedule: MIN_CONTENT_DAYS_AHEAD,
      lowCoverThreshold: LOW_REVIEWED_COVER_DAYS,
      alerts,
      days,
      coverage: tally(puzzles, agendaFrom, wordById, questionById, eventById),
      bank: {
        words: allWords.filter((w) => w.active).length,
        questions: allQuestions.filter((q) => q.active).length,
        events: allEvents.filter((e) => e.active).length,
        acceptedExtra: extra.length,
      },
    }
  }
}

function toDay(
  p: DailyPuzzle,
  wordById: Map<string, DailyWord>,
  questionById: Map<string, DailyQuestion>,
  eventById: Map<string, DailyEvent>,
): AdminAgendaDay {
  const word = wordById.get(p.wordId)
  const question = questionById.get(p.questionId)
  return {
    number: p.number,
    date: p.gameDate,
    reviewed: p.reviewedAt !== null,
    published: p.publishedAt !== null,
    origins: { word: p.wordOrigin, question: p.questionOrigin, timeline: p.timelineOrigin },
    word: word ? { display: word.display, category: word.category, scope: word.scope } : null,
    question: question
      ? { text: question.question, category: question.category, scope: question.scope }
      : null,
    events: p.timelineEventIds.flatMap((id) => {
      const e = eventById.get(id)
      return e ? [{ label: e.label, year: e.year, category: e.category, scope: e.scope }] : []
    }),
  }
}

function tally(
  puzzles: DailyPuzzle[],
  from: string,
  wordById: Map<string, DailyWord>,
  questionById: Map<string, DailyQuestion>,
  eventById: Map<string, DailyEvent>,
): AdminOverview['coverage'] {
  const limit = addDays(from, COVERAGE_WINDOW_DAYS)
  const coverage = {
    windowDays: COVERAGE_WINDOW_DAYS,
    word: emptyTally(),
    trivia: emptyTally(),
    timeline: emptyTally(),
  }
  for (const p of puzzles) {
    if (p.gameDate >= limit) continue
    const word = wordById.get(p.wordId)
    if (word) addToTally(coverage.word, word)
    const question = questionById.get(p.questionId)
    if (question) addToTally(coverage.trivia, question)
    for (const id of p.timelineEventIds) {
      const event = eventById.get(id)
      if (event) addToTally(coverage.timeline, event)
    }
  }
  return coverage
}
