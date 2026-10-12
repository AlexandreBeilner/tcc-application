import { mergeAssemblyEvents, realWindowOf } from '../calendarAssemblies'
import type { AssemblyCalendarSource } from '../ports/assemblyCalendarSource'
import type {
  CalendarScope,
  MarketCalendar,
  MarketCalendarReader,
} from '../ports/marketCalendarReader'

export interface GetMarketCalendarInput {
  userId: string
  from?: string
  to?: string
  scope?: CalendarScope
  marketLimit?: number
}

export class GetMarketCalendarUseCase {
  // `assemblies` é opcional: sem ele (assembleias desligadas) o calendário é o do motor, intacto.
  constructor(
    private readonly marketCalendarReader: MarketCalendarReader,
    private readonly assemblies?: AssemblyCalendarSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: GetMarketCalendarInput): Promise<MarketCalendar> {
    const calendar = await this.marketCalendarReader.getCalendar(input.userId, {
      from: input.from,
      to: input.to,
      scope: input.scope,
      market_limit: input.marketLimit,
    })
    // Os marcos das assembleias são fatos de mercado: não entram no recorte "só o meu".
    if (!this.assemblies || input.scope === 'mine') return calendar
    try {
      const now = this.now()
      const clock = await this.marketCalendarReader.getClock()
      const { from, to } = realWindowOf(calendar, now, clock)
      return mergeAssemblyEvents(calendar, await this.assemblies.listBetween(from, to), now, clock)
    } catch (err) {
      // Calendário nunca cai por causa das assembleias.
      console.error('calendário: falha ao incluir as assembleias', err)
      return calendar
    }
  }
}
