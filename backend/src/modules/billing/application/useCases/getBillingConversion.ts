import { buildBillingMetrics } from '../../domain/funnel'
import type { BillingMetrics, BillingPrices } from '../../domain/funnel'
import type { FunnelReader } from '../ports/funnelReader'
import type { SubscriptionRepository } from '../ports/subscriptionRepository'

export const CONVERSION_WINDOWS = [7, 30, 90] as const
export type ConversionWindow = (typeof CONVERSION_WINDOWS)[number]

const DAY_MS = 86_400_000

// Painel de conversão do admin (MO.7.1): assinantes ativos, mensal x anual, churn, receita
// recorrente estimada e funil por ponto de convite. Só leitura. As assinaturas vêm da projeção
// local (a verdade do RevenueCat já sincronizada) e os passos do funil dos eventos próprios.
export class GetBillingConversionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly funnel: FunnelReader,
    private readonly prices: BillingPrices,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(windowDays: ConversionWindow = 30): Promise<BillingMetrics> {
    const now = this.now()
    const [subscriptions, summary] = await Promise.all([
      this.subscriptions.listAll(),
      this.funnel.summarize(new Date(now.getTime() - windowDays * DAY_MS)),
    ])
    return buildBillingMetrics({ subscriptions, summary, prices: this.prices, windowDays, now })
  }
}
