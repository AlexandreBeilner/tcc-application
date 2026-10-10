import { ProRequiredError } from '../domain/errors'
import type { GetSubscriptionStatusUseCase } from './useCases/getSubscriptionStatus'

// O que um caso de uso de feature PRO injeta pra exigir o plano. Mantém "isto exige PRO" na regra
// de negócio (`application/useCases/`), não em middleware genérico.
export class ProAccessGuard {
  constructor(private readonly status: GetSubscriptionStatusUseCase) {}

  async assertPro(userId: string): Promise<void> {
    const { isPro } = await this.status.execute(userId)
    if (!isPro) throw new ProRequiredError()
  }
}
