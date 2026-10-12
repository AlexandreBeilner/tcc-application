import type { ReconciliationAudience } from '../ports/reconciliationAudience'
import type { SyncSubscriptionUseCase } from './syncSubscription'

export interface ReconcileOptions {
  // Projeção sem reconsulta há mais que isto é reconferida.
  staleAfterMs: number
  // Vencida há mais que isto sai da conta.
  expiredGraceMs: number
  batchSize: number
  // Pausa entre consultas pra não estourar o limite de requisições do provedor.
  delayBetweenMs: number
}

export const DEFAULT_RECONCILE_OPTIONS: ReconcileOptions = {
  staleAfterMs: 12 * 3_600_000,
  expiredGraceMs: 3 * 86_400_000,
  batchSize: 200,
  delayBetweenMs: 200,
}

export interface ReconcileResult {
  checked: number
  failed: number
}

// Rede de segurança do webhook: ele pode não chegar (deploy fora do ar, cinco tentativas
// esgotadas). Reconsulta periodicamente quem tem projeção velha, o que corrige tanto um
// cancelamento perdido quanto uma expiração que nunca foi avisada. Uma falha isolada não para o
// lote: o usuário volta no próximo ciclo.
export class ReconcileSubscriptionsUseCase {
  constructor(
    private readonly audience: ReconciliationAudience,
    private readonly sync: SyncSubscriptionUseCase,
    private readonly options: ReconcileOptions = DEFAULT_RECONCILE_OPTIONS,
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async execute(): Promise<ReconcileResult> {
    const at = this.now()
    const userIds = await this.audience.findStale({
      staleBefore: new Date(at.getTime() - this.options.staleAfterMs),
      relevantSince: new Date(at.getTime() - this.options.expiredGraceMs),
      limit: this.options.batchSize,
    })

    let failed = 0
    for (const [index, userId] of userIds.entries()) {
      if (index > 0 && this.options.delayBetweenMs > 0)
        await this.sleep(this.options.delayBetweenMs)
      try {
        await this.sync.execute(userId)
      } catch (err) {
        failed += 1
        console.error(`cobrança: falha ao reconciliar o usuário ${userId}`, err)
      }
    }
    return { checked: userIds.length, failed }
  }
}
