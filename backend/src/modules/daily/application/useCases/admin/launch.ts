import { consecutiveDaysFrom } from '../../../domain/adminCoverage'
import { DailyAdminConflictError, DailyAdminInvalidError } from '../../../domain/errors'
import { dailyDay, isDateKey, resolveStatus } from '../../../domain/gameDay'
import {
  MIN_CONTENT_DAYS_AHEAD,
  validateStartDateChange,
  type StartDateChangeError,
} from '../../../domain/launchSchedule'
import type { DraftResult, StartDateResult } from '../../adminViews'
import type { DailyPuzzleRepository } from '../../ports/dailyPuzzleRepository'
import type { DailySettingsRepository } from '../../ports/dailySettingsRepository'
import type { MaterializeUpcomingPuzzlesUseCase } from '../materializeUpcomingPuzzles'

// Dias lidos para contar os revisados: folga sobre o mínimo, para a contagem poder passar de 30.
const REVIEW_LOOKAHEAD = MIN_CONTENT_DAYS_AHEAD + 30

// Qualquer data anterior a todas as outras: "tudo".
const ALL_TIME = '1970-01-01'

const CONFLICT_MESSAGES: Record<StartDateChangeError, string> = {
  already_started: 'o Diário já está no ar; a data de estreia não muda mais',
  not_in_future: 'a data de estreia precisa ser depois de hoje',
  insufficient_content: `a estreia exige ${MIN_CONTENT_DAYS_AHEAD} dias seguidos de jogos revisados a partir da data`,
}

function parseDate(value: string): void {
  if (!isDateKey(value)) throw new DailyAdminInvalidError(['data inválida, use AAAA-MM-DD'])
}

// Gera o rascunho dos próximos dias para uma data de estreia candidata. Sem isso não haveria como
// agendar: a agenda só materializa depois que a estreia está gravada, e a estreia só grava com
// dias revisados. Não grava a data; só vale enquanto o Diário não está no ar.
export class PrepareLaunchDraftUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly puzzles: DailyPuzzleRepository,
    private readonly materialize: MaterializeUpcomingPuzzlesUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(startDate: string): Promise<DraftResult> {
    parseDate(startDate)
    const today = dailyDay(this.now())
    const current = (await this.settings.get()).startDate
    if (resolveStatus(current, today).status === 'live') {
      throw new DailyAdminConflictError('already_started', CONFLICT_MESSAGES.already_started)
    }
    if (startDate <= today) {
      throw new DailyAdminConflictError('not_in_future', CONFLICT_MESSAGES.not_in_future)
    }
    // Outra data renumera os jogos, e jogo publicado não se renumera: sai do ar até agendar de novo
    // (a agenda publica os revisados em lote) ou publicar pelo painel.
    if (current !== startDate) await this.puzzles.unpublishFrom(ALL_TIME)
    const result = await this.materialize.execute(startDate)
    return { startDate, created: result.created.length, warnings: result.warnings }
  }
}

// Agenda, muda ou desliga a estreia (seção 3.5). A data muda à vontade enquanto futura e trava
// quando o jogo está no ar. Agendar exige 30 dias seguidos de jogos revisados a partir dela.
// Gravada a data, os jogos não publicados são realinhados (renumerados) e os revisados são
// publicados em lote (ponto 058, decisão (b)); antes disso tudo sai do ar, porque jogo publicado
// não se renumera e a data pode ter andado.
export class SetStartDateUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly puzzles: DailyPuzzleRepository,
    private readonly materialize: MaterializeUpcomingPuzzlesUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actorId: string, next: string | null): Promise<StartDateResult> {
    if (next !== null) parseDate(next)
    const now = this.now()
    const today = dailyDay(now)
    const current = (await this.settings.get()).startDate

    const reviewedDaysFromNext =
      next === null
        ? 0
        : consecutiveDaysFrom(
            next,
            (await this.puzzles.listFromDate(next, REVIEW_LOOKAHEAD)).map((p) => ({
              gameDate: p.gameDate,
              ok: p.reviewedAt !== null,
            })),
          )
    const error = validateStartDateChange({ current, next, today, reviewedDaysFromNext })
    if (error) throw new DailyAdminConflictError(error, CONFLICT_MESSAGES[error])

    await this.settings.setStartDate(next, actorId, now)
    await this.puzzles.unpublishFrom(ALL_TIME)
    if (next === null) return { startDate: null, status: 'off', published: [] }

    await this.materialize.execute()
    const published = await this.puzzles.publishReviewed(ALL_TIME, now)
    return { startDate: next, status: resolveStatus(next, today).status, published }
  }
}
