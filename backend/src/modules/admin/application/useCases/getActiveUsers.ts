import { addDays, utcDay } from '../../domain/retention'
import type { RetentionReader } from '../ports/retentionReader'

export const DEFAULT_ACTIVE_DAYS = 60
// MAU = pessoas distintas nos últimos 30 dias, incluindo o próprio dia.
export const MAU_WINDOW_DAYS = 30

export interface ActiveDay {
  day: string
  // Nulos antes do início do registro da medida (sem dado, não é zero).
  returned: number | null
  studied: number | null
  mau: number | null
  // DAU/MAU: fração do mês que aparece num dia típico. Nula enquanto a janela de 30 dias não está
  // toda dentro do período registrado (um MAU incompleto inflaria a razão).
  dau_mau: number | null
}

export interface ActiveUsers {
  tracking_since: { presence: string | null; activity: string | null }
  // Do mais antigo para o mais recente; termina ontem (hoje ainda não fechou).
  days: ActiveDay[]
}

export class GetActiveUsersUseCase {
  constructor(
    private readonly reader: RetentionReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { days?: number } = {}): Promise<ActiveUsers> {
    const length = input.days ?? DEFAULT_ACTIVE_DAYS
    const to = addDays(utcDay(this.now()), -1)
    const from = addDays(to, -(length - 1))
    const tracking = await this.reader.trackingStart()
    const rows = await this.reader.dailyActive({ from, to })

    const days = rows.map<ActiveDay>((row) => {
      const presenceTracked = tracking.presenceSince !== null && row.day >= tracking.presenceSince
      const activityTracked = tracking.activitySince !== null && row.day >= tracking.activitySince
      const windowTracked =
        tracking.presenceSince !== null &&
        addDays(row.day, -(MAU_WINDOW_DAYS - 1)) >= tracking.presenceSince
      const mau = windowTracked ? row.mau : null
      return {
        day: row.day,
        returned: presenceTracked ? row.returned : null,
        studied: activityTracked ? row.studied : null,
        mau,
        dau_mau: mau !== null && mau > 0 ? row.returned / mau : null,
      }
    })

    return {
      tracking_since: { presence: tracking.presenceSince, activity: tracking.activitySince },
      days,
    }
  }
}
