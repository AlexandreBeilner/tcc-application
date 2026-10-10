import type {
  EngineSettingKey,
  EngineSettings,
  EngineSettingsAdmin,
} from '../../application/ports/engineSettingsAdmin'

export interface FakeEngineSettingsAdmin extends EngineSettingsAdmin {
  calls: string[]
  saved: Array<{ key: EngineSettingKey; value: number; adminId: string }>
  resets: EngineSettingKey[]
  errorToThrow?: Error
}

export const sampleSettings: EngineSettings = {
  editable: [
    {
      key: 'ticks_per_day',
      value: 5,
      default: 5,
      min: 1,
      max: 24,
      overridden: false,
      updated_by: null,
      updated_at: null,
      version: 0,
    },
    {
      key: 'max_catch_up',
      value: 3,
      default: 3,
      min: 1,
      max: 30,
      overridden: false,
      updated_by: null,
      updated_at: null,
      version: 0,
    },
  ],
  read_only: [
    { key: 'initial_capital', value: 'R$ 10000.00', reason: 'Capital inicial é fixo (RNF06).' },
  ],
}

export function createFakeEngineSettingsAdmin(): FakeEngineSettingsAdmin {
  const fake: FakeEngineSettingsAdmin = {
    calls: [],
    saved: [],
    resets: [],
    errorToThrow: undefined,
    async list() {
      fake.calls.push('list')
      if (fake.errorToThrow) throw fake.errorToThrow
      return sampleSettings
    },
    async set(key, value, adminId) {
      fake.calls.push('set')
      fake.saved.push({ key, value, adminId })
      if (fake.errorToThrow) throw fake.errorToThrow
      return sampleSettings
    },
    async reset(key) {
      fake.calls.push('reset')
      fake.resets.push(key)
      if (fake.errorToThrow) throw fake.errorToThrow
      return sampleSettings
    },
  }
  return fake
}
