import type {
  EngineSettingKey,
  EngineSettings,
  EngineSettingsAdmin,
} from '../ports/engineSettingsAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Altera um parâmetro de ritmo (N.7). A faixa é regra do motor; aqui só a auditoria,
// inclusive quando o motor recusa (valor fora da faixa, chave somente leitura). O valor
// novo fica no payload. O valor anterior não: quem precisa dele lê a linha anterior da chave.
export class UpdateEngineSettingUseCase {
  constructor(
    private readonly engineSettingsAdmin: EngineSettingsAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, key: EngineSettingKey, value: number): Promise<EngineSettings> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'settings.update',
        targetType: 'engine_setting',
        targetId: key,
        payload: { key, value },
      },
      () => this.engineSettingsAdmin.set(key, value, adminId),
    )
  }
}
