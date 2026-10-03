import type { MacroEventAdmin, MacroEventDetail } from '../../application/ports/macroEventAdmin'
import type { UserViewProjector } from '../../application/ports/userViewProjector'

export interface FakeMacroEventAdmin extends MacroEventAdmin {
  calls: string[]
  detailCalls: Array<{ eventId: string; windowDays?: number }>
  cancelled: string[]
  errorToThrow?: Error
}

export const sampleDetail: MacroEventDetail = {
  id: 'event-1',
  title: 'título',
  narrative: 'narrativa',
  direction: 'negativo',
  magnitude_band: 'moderado',
  affects_price: true,
  affects_fundamentals: false,
  status: 'pendente',
  triggered_on_day: 130,
  duration_days: 2,
  price_effect_pct: -10,
  targets: [{ sector: 'Mineração' }],
  scheduled: true,
  cancellable: true,
  created_by: 'admin-1',
  current_day: 100,
  publicly_visible: false,
  impact: {
    available: false,
    window_days: 5,
    base_day: 129,
    end_day: 134,
    available_on_day: 134,
    targets: [],
  },
}

export function createFakeMacroEventAdmin(): FakeMacroEventAdmin {
  const fake: FakeMacroEventAdmin = {
    calls: [],
    detailCalls: [],
    cancelled: [],
    errorToThrow: undefined,
    async detail(eventId, windowDays) {
      fake.calls.push('detail')
      fake.detailCalls.push({ eventId, windowDays })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleDetail, id: eventId }
    },
    async cancel(eventId) {
      fake.calls.push('cancel')
      fake.cancelled.push(eventId)
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleDetail, id: eventId, status: 'cancelado', scheduled: false }
    },
  }
  return fake
}

// Projetor de teste: marca o que o usuário veria sem depender do módulo de notícias.
export const fakeUserViewProjector: UserViewProjector = {
  project: (event) => ({ ...event, direction: '', magnitude_band: '', targets: [] }),
}
