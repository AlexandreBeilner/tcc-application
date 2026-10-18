import { buildAdminWorld } from '../../../daily/test/adminWorld'
import { createInProcessDailyAdmin } from '../../infrastructure/daily/inProcessDailyAdmin'

// Painel do Diário sobre os repositórios falsos do módulo `daily`, com o adapter real no meio
// (a tradução de erros é parte do que o router testa). `world` dá acesso ao estado para o teste.
export function createInMemoryDailyAdmin(options: { startDate: string | null; now: string }) {
  const world = buildAdminWorld(options)
  return { world, dailyAdmin: createInProcessDailyAdmin(world) }
}
