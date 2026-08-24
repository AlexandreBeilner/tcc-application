import type {
  ListMacroEventsQuery,
  ListMacroEventsResult,
  MacroEventReader,
} from '../../application/ports/macroEventReader'

export interface FakeMacroEventReader extends MacroEventReader {
  calls: ListMacroEventsQuery[]
  errorToThrow?: Error
}

export function createFakeMacroEventReader(result: ListMacroEventsResult): FakeMacroEventReader {
  const calls: ListMacroEventsQuery[] = []
  const fake: FakeMacroEventReader = {
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
