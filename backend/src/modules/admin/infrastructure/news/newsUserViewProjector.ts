import { redactPending } from '../../../news/domain/redactPending'
import type { UserViewProjector } from '../../application/ports/userViewProjector'

// Adapter sobre a regra do módulo de notícias (RF16, `redactPending`): a mesma função que
// o feed aplica, pra o painel mostrar ao admin exatamente a versão que o usuário vê.
export function createNewsUserViewProjector(): UserViewProjector {
  return {
    project(event) {
      return redactPending([event])[0]
    },
  }
}
