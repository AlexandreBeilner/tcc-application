import { IntegrityAlreadyRunningError } from '../../domain/errors'
import type { IntegrityAdmin, IntegrityRun } from '../../application/ports/integrityAdmin'

export interface FakeIntegrityAdmin extends IntegrityAdmin {
  calls: string[]
  current: IntegrityRun | null
  running: boolean
}

export const sampleRun: IntegrityRun = {
  id: 'run-1',
  status: 'running',
  started_at: '2026-10-06T12:00:00Z',
  finished_at: null,
  error: null,
  report: null,
}

export function createFakeIntegrityAdmin(): FakeIntegrityAdmin {
  const fake: FakeIntegrityAdmin = {
    calls: [],
    current: null,
    running: false,
    async start() {
      fake.calls.push('start')
      if (fake.running)
        throw new IntegrityAlreadyRunningError('já existe uma verificação em andamento')
      fake.running = true
      fake.current = sampleRun
      return sampleRun
    },
    async latest() {
      fake.calls.push('latest')
      return fake.current
    },
  }
  return fake
}
