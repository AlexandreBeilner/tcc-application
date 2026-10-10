import type { TickResult, TickTrigger } from '../../application/ports/tickTrigger'

export interface FakeTickTrigger extends TickTrigger {
  calls: number
  errorToThrow?: Error
}

export function createFakeTickTrigger(result: TickResult): FakeTickTrigger {
  const fake: FakeTickTrigger = {
    calls: 0,
    errorToThrow: undefined,
    async run() {
      fake.calls += 1
      if (fake.errorToThrow) {
        throw fake.errorToThrow
      }
      return result
    },
  }
  return fake
}
