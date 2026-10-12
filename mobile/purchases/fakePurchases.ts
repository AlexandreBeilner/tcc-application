/**
 * Implementação falsa de `PurchasesService` (MO.4.1), só para desenvolvimento sem contas de loja.
 * "Compra" chamando `POST /billing/dev/purchase` do backend, que só existe com
 * `BILLING_PROVIDER=dev` (recusado em produção). O sufixo "(teste)" nos preços aparece na tela
 * para ninguém confundir com uma loja de verdade. `createPurchasesService` nunca devolve esta
 * classe fora de `__DEV__`.
 *
 * @format
 */
import type {
  PlanId,
  PurchaseOutcome,
  PurchasesService,
  StorePlan,
} from './types';

export interface FakePurchasesOptions {
  apiBaseUrl: string;
  platform: 'android' | 'ios';
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
}

const FAKE_PLANS: StorePlan[] = [
  {
    id: 'monthly',
    formattedPrice: 'R$ 19,90 (teste)',
    amountMicros: 19_900_000,
    currency: 'BRL',
  },
  {
    id: 'annual',
    formattedPrice: 'R$ 199,90 (teste)',
    amountMicros: 199_900_000,
    currency: 'BRL',
  },
];

export function createFakePurchases(
  options: FakePurchasesOptions,
): PurchasesService {
  const doFetch = options.fetchImpl ?? fetch;
  const store = options.platform === 'ios' ? 'app_store' : 'play_store';
  let userId: string | null = null;

  async function call(path: string, init: RequestInit): Promise<Response> {
    const token = options.getToken();
    if (!userId || !token) {
      throw new Error('compra sem sessão: faça login antes');
    }
    const response = await doFetch(`${options.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`${path} respondeu ${response.status}`);
    }
    return response;
  }

  return {
    async logIn(id) {
      userId = id;
    },
    async logOut() {
      userId = null;
    },
    async listPlans() {
      return FAKE_PLANS;
    },
    async purchase(plan: PlanId): Promise<PurchaseOutcome> {
      await call('/billing/dev/purchase', {
        method: 'POST',
        body: JSON.stringify({ plan, store }),
      });
      return 'purchased';
    },
    async restore() {
      const response = await call('/billing/status', { method: 'GET' });
      const body = (await response.json()) as { isPro?: boolean };
      return { hasPro: body.isPro === true };
    },
    async managementUrl() {
      return null;
    },
  };
}
