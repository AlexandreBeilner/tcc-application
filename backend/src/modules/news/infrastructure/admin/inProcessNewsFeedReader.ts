import type { ListMacroEventsUseCase } from '../../../admin/application/useCases/listMacroEvents'
import type { NewsFeedReader } from '../../application/ports/newsFeedReader'

// Adapter em processo sobre o caso de uso já existente de modules/admin
// (tarefa 4.5) — mesmo padrão de modules/profile (5.10)/modules/ranking
// (5.9): port própria no módulo consumidor, implementada por um wrapper
// sobre a classe concreta do módulo produtor, nunca a classe injetada
// direto no caso de uso de `news`.
export function createInProcessNewsFeedReader(
  listMacroEvents: ListMacroEventsUseCase,
): NewsFeedReader {
  return {
    list(query) {
      return listMacroEvents.execute(query)
    },
  }
}
