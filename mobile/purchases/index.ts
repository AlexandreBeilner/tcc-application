/**
 * Fábrica da camada de compras (MO.4.1). Escolhe a implementação por configuração
 * (`PURCHASES_MODE` em `.env.debug|.env.release`):
 *  - `fake`: só vale com `__DEV__`; num build de release é tratado como indisponível, nunca vira
 *    compra falsa em produção;
 *  - `revenuecat`: usa a chave pública da plataforma; chave em branco = indisponível.
 *
 * @format
 */
import { createFakePurchases } from './fakePurchases';
import { createRevenueCatPurchases } from './revenueCatPurchases';
import { PurchasesUnavailableError } from './types';
import type { PurchasesService } from './types';

export * from './types';

export interface PurchasesConfig {
  mode: string | undefined;
  platform: 'android' | 'ios';
  isDev: boolean;
  apiBaseUrl: string;
  androidApiKey: string | undefined;
  iosApiKey: string | undefined;
  getToken: () => string | null;
}

export function createUnavailablePurchases(): PurchasesService {
  const unavailable = () => Promise.reject(new PurchasesUnavailableError());
  return {
    logIn: async () => undefined,
    logOut: async () => undefined,
    listPlans: unavailable,
    purchase: unavailable,
    restore: unavailable,
    managementUrl: async () => null,
  };
}

export function createPurchasesService(
  config: PurchasesConfig,
): PurchasesService {
  if (config.mode === 'fake' && config.isDev) {
    return createFakePurchases({
      apiBaseUrl: config.apiBaseUrl,
      platform: config.platform,
      getToken: config.getToken,
    });
  }
  if (config.mode === 'revenuecat') {
    const apiKey =
      config.platform === 'ios' ? config.iosApiKey : config.androidApiKey;
    if (apiKey) {
      return createRevenueCatPurchases({ apiKey });
    }
  }
  return createUnavailablePurchases();
}
