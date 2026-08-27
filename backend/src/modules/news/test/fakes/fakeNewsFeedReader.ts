import type {
  NewsFeedQuery,
  NewsFeedReader,
  NewsFeedResult,
} from '../../application/ports/newsFeedReader'

export interface FakeNewsFeedReader extends NewsFeedReader {
  calls: NewsFeedQuery[]
  errorToThrow?: Error
}

export function createFakeNewsFeedReader(result: NewsFeedResult): FakeNewsFeedReader {
  const calls: NewsFeedQuery[] = []
  const fake: FakeNewsFeedReader = {
    calls,
    errorToThrow: undefined,
    async list(query) {
      calls.push(query)
      if (fake.errorToThrow) {
        throw fake.errorToThrow
      }
      return result
    },
  }
  return fake
}
