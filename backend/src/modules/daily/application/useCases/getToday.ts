import { DailyGameNotFoundError, DailyGameUnavailableError } from '../../domain/errors'
import { dailyDay, dayStartInstant, gameNumberFor, resolveStatus } from '../../domain/gameDay'
import type { DailyGameLoader } from '../dailyGameLoader'
import { toPublicGame, type PublicGame } from '../publicGame'
import type { DailySettingsRepository } from '../ports/dailySettingsRepository'

export type TodayResult =
  | { status: 'off' }
  // Antes da estreia só isto é revelado (seção 3.5): nenhum conteúdo, só a data.
  | { status: 'scheduled'; startDate: string; startsAt: string }
  | { status: 'live'; game: PublicGame }

// `GET /daily/today`: o estado do Diário e, no ar, o jogo do dia sem gabarito.
export class GetTodayUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly loader: DailyGameLoader,
  ) {}

  async execute(input: { now: Date }): Promise<TodayResult> {
    const { startDate } = await this.settings.get()
    const state = resolveStatus(startDate, dailyDay(input.now))
    if (state.status === 'off') return { status: 'off' }
    if (state.status === 'scheduled') {
      return {
        status: 'scheduled',
        startDate: state.startDate,
        startsAt: dayStartInstant(state.startDate).toISOString(),
      }
    }

    const number = gameNumberFor(state.startDate, dailyDay(input.now)) as number
    try {
      return {
        status: 'live',
        game: toPublicGame(await this.loader.load(number, input.now), input.now),
      }
    } catch (err) {
      // Dia de hoje sem jogo materializado: o chamador responde "indisponível", não "não existe".
      if (err instanceof DailyGameNotFoundError) throw new DailyGameUnavailableError()
      throw err
    }
  }
}
