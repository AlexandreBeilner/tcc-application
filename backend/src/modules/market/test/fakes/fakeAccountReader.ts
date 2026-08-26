import type {
  AccountBalance,
  AccountEventRecord,
  AccountReader,
  FixedIncomePositionRecord,
  ListAccountEventsQuery,
  PositionRecord,
} from '../../application/ports/accountReader'

export interface FakeAccountReader extends AccountReader {
  getAccountCalls: string[]
  listPositionsCalls: string[]
  listFixedIncomePositionsCalls: string[]
  listAccountEventsCalls: Array<{ userId: string; query: ListAccountEventsQuery }>
  errorToThrow?: Error
}

export function createFakeAccountReader(results: {
  account?: AccountBalance
  positions?: PositionRecord[]
  fixedIncomePositions?: FixedIncomePositionRecord[]
  events?: AccountEventRecord[]
}): FakeAccountReader {
  const fake: FakeAccountReader = {
    getAccountCalls: [],
    listPositionsCalls: [],
    listFixedIncomePositionsCalls: [],
    listAccountEventsCalls: [],
    errorToThrow: undefined,
    async getAccount(userId) {
      fake.getAccountCalls.push(userId)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.account as AccountBalance
    },
    async listPositions(userId) {
      fake.listPositionsCalls.push(userId)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.positions ?? []
    },
    async listFixedIncomePositions(userId) {
      fake.listFixedIncomePositionsCalls.push(userId)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.fixedIncomePositions ?? []
    },
    async listAccountEvents(userId, query) {
      fake.listAccountEventsCalls.push({ userId, query })
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.events ?? []
    },
  }
  return fake
}
