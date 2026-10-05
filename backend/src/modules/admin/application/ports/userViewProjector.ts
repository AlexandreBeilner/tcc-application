import type { MacroEventResult } from './macroEventTrigger'

// A versão de um evento macro que o usuário vê no feed (RF16): enquanto o evento está
// pendente, o veredito (direção, magnitude, efeitos e alvos) é redigido. A regra vive
// no módulo de notícias; o painel só a consulta por aqui pra mostrar ao admin exatamente
// o que o usuário enxerga.
export interface UserViewProjector {
  project(event: MacroEventResult): MacroEventResult
}
