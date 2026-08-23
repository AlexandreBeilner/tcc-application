import type {
  ListMacroEventsQuery,
  ListMacroEventsResult,
  MacroEventReader,
} from '../ports/macroEventReader'

// Mesma justificativa de TriggerMacroEventUseCase: existe como classe (não
// uma chamada direta à port no router) pra manter o padrão já estabelecido
// pelo módulo e o ponto único de teste de caso de uso isolado da borda
// HTTP, ainda que a orquestração em si seja uma delegação fina.
export class ListMacroEventsUseCase {
  constructor(private readonly macroEventReader: MacroEventReader) {}

  async execute(query: ListMacroEventsQuery): Promise<ListMacroEventsResult> {
    return this.macroEventReader.list(query)
  }
}
