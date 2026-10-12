import type {
  AccountBalance,
  AccountEventRecord,
  AccountReader,
  FixedIncomePositionRecord,
  ListAccountEventsQuery,
  ListFixedIncomePositionsOptions,
  PositionRecord,
} from '../../application/ports/accountReader'

export interface FakeAccountReader extends AccountReader {
  getAccountCalls: string[]
  listPositionsCalls: string[]
  listFixedIncomePositionsCalls: string[]
  listFixedIncomePositionsOptions: Array<ListFixedIncomePositionsOptions | undefined>
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
    listFixedIncomePositionsOptions: [],
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
    async listFixedIncomePositions(userId, options) {
      fake.listFixedIncomePositionsCalls.push(userId)
      fake.listFixedIncomePositionsOptions.push(options)
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
