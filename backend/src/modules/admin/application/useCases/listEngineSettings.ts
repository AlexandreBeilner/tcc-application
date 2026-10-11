import type {
  EngineSettingGroup,
  EngineSettings,
  EngineSettingsAdmin,
} from '../ports/engineSettingsAdmin'

// Delegação fina (leitura): parâmetros editáveis e somente leitura.
export class ListEngineSettingsUseCase {
  constructor(private readonly engineSettingsAdmin: EngineSettingsAdmin) {}

  async execute(group?: EngineSettingGroup): Promise<EngineSettings> {
    return this.engineSettingsAdmin.list(group)
  }
}
