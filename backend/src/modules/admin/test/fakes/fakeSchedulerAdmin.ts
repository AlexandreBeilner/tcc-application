import type {
  AdvanceTicksResult,
  ListTicksQuery,
  ListTicksResult,
  SchedulerAdmin,
  SchedulerStatus,
} from '../../application/ports/schedulerAdmin'

export interface FakeSchedulerAdmin extends SchedulerAdmin {
  status: SchedulerStatus
  calls: string[]
  listQueries: ListTicksQuery[]
  errorToThrow?: Error
}

export const sampleStatus: SchedulerStatus = {
  enabled: true,
  paused: false,
  resumed_at: null,
  ticks_per_day: 5,
  timezone: 'America/Sao_Paulo',
  max_catch_up: 3,
  next_slot_at: '2026-10-03T15:00:00Z',
  tick_in_progress: false,
  last_tick_at: '2026-10-03T10:00:00Z',
}

export function createFakeSchedulerAdmin(
  listResult: ListTicksResult = { ticks: [], total_entries: 0 },
  advanceResult: AdvanceTicksResult = { requested: 0, ticks: [] },
): FakeSchedulerAdmin {
  const fake: FakeSchedulerAdmin = {
    status: { ...sampleStatus },
    calls: [],
    listQueries: [],
    errorToThrow: undefined,
    async getStatus() {
      fake.calls.push('status')
      if (fake.errorToThrow) throw fake.errorToThrow
      return fake.status
    },
    async pause() {
      fake.calls.push('pause')
      if (fake.errorToThrow) throw fake.errorToThrow
      fake.status = { ...fake.status, paused: true, next_slot_at: null }
      return fake.status
    },
    async resume() {
      fake.calls.push('resume')
      if (fake.errorToThrow) throw fake.errorToThrow
      fake.status = { ...fake.status, paused: false, resumed_at: '2026-10-03T12:00:00Z' }
      return fake.status
    },
    async listTicks(query) {
      fake.calls.push('listTicks')
      fake.listQueries.push(query)
      if (fake.errorToThrow) throw fake.errorToThrow
      return listResult
    },
    async advance(days) {
      fake.calls.push(`advance:${days}`)
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...advanceResult, requested: days }
    },
  }
  return fake
}
