import type {
  EngineSettingKey,
  EngineSettings,
  EngineSettingsAdmin,
} from '../ports/engineSettingsAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Restaura o padrão do ambiente de um parâmetro de ritmo (N.7). Idempotente no motor.
export class ResetEngineSettingUseCase {
  constructor(
    private readonly engineSettingsAdmin: EngineSettingsAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, key: EngineSettingKey): Promise<EngineSettings> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'settings.reset',
        targetType: 'engine_setting',
        targetId: key,
        payload: { key },
      },
      () => this.engineSettingsAdmin.reset(key),
    )
  }
}
