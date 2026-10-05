import type { EngineSettings, EngineSettingsAdmin } from '../ports/engineSettingsAdmin'

// Delegação fina (leitura): parâmetros editáveis e somente leitura.
export class ListEngineSettingsUseCase {
  constructor(private readonly engineSettingsAdmin: EngineSettingsAdmin) {}

  async execute(): Promise<EngineSettings> {
    return this.engineSettingsAdmin.list()
  }
}
