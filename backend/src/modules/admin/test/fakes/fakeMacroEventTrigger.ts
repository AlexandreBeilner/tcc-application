import type {
  MacroEventResult,
  MacroEventTrigger,
  TriggerMacroEventInput,
} from '../../application/ports/macroEventTrigger'

export interface FakeMacroEventTrigger extends MacroEventTrigger {
  calls: TriggerMacroEventInput[]
  errorToThrow?: Error
}

export function createFakeMacroEventTrigger(result: MacroEventResult): FakeMacroEventTrigger {
  const calls: TriggerMacroEventInput[] = []
  const fake: FakeMacroEventTrigger = {
    calls,
    errorToThrow: undefined,
    async trigger(input) {
      calls.push(input)
      if (fake.errorToThrow) {
        throw fake.errorToThrow
      }
      return result
    },
  }
  return fake
}
