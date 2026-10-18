// Módulo do Diário Selucra (DI.3.1): jogo sem framework, usado pela landing (modo `publico`) e pelo app (modo `app`).
// Só desenha e envia: toda regra (cores do Termo, acerto, ordem certa, XP) vem do servidor.
export { createDailyApi, DailyApiError, reportMetric } from './api.ts'
export type { ApiOptions, DailyApi, MetricEvent } from './api.ts'
export { createLocalKeeper, createServerKeeper, parseState, STORAGE_KEY, KEEP_GAMES } from './keeper.ts'
export type { StateKeeper } from './keeper.ts'
export { mountDiario } from './game.ts'
export type { DiarioController, MountOptions } from './game.ts'
export { buildShareText } from './share.ts'
export type * from './types.ts'
