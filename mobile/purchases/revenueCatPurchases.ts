/**
 * Implementação real de `PurchasesService` sobre `react-native-purchases` (MO.4.1). Única peça do
 * app que importa o SDK. Nunca rodou contra o RevenueCat de verdade (sem conta ainda): o desenho
 * segue a documentação do SDK e deve ser conferido com a chave em mãos (MO.4.4).
 *
 * @format
 */
import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import type {
  PlanId,
  PurchaseOutcome,
  PurchasesService,
  StorePlan,
} from './types';

const ENTITLEMENT_ID = 'selucra_pro';

interface PurchasesError {
  userCancelled?: boolean;
}

export function createRevenueCatPurchases(options: {
  apiKey: string;
}): PurchasesService {
  let configured = false;
  let loggedIn = false;
  // Operações de sessão em fila: uma compra logo depois do login espera o login terminar.
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  function ensureConfigured() {
    if (!configured) {
      Purchases.configure({ apiKey: options.apiKey });
      configured = true;
    }
  }

  async function packageFor(plan: PlanId): Promise<PurchasesPackage> {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    const found = plan === 'monthly' ? current?.monthly : current?.annual;
    if (!found) {
      throw new Error(`pacote ${plan} ausente do Offering atual`);
    }
    return found;
  }

  return {
    logIn: userId =>
      enqueue(async () => {
        ensureConfigured();
        await Purchases.logIn(userId);
        loggedIn = true;
      }),
    logOut: () =>
      enqueue(async () => {
        // Anônimo não pode fazer logOut no SDK (erro): sem login, nada a fazer.
        if (!configured || !loggedIn) {
          return;
        }
        await Purchases.logOut();
        loggedIn = false;
      }),
    listPlans: () =>
      enqueue(async () => {
        ensureConfigured();
        const current = (await Purchases.getOfferings()).current;
        const plans: StorePlan[] = [];
        for (const [id, pkg] of [
          ['monthly', current?.monthly],
          ['annual', current?.annual],
        ] as const) {
          if (pkg) {
            plans.push({
              id,
              formattedPrice: pkg.product.priceString,
              amountMicros: Math.round(pkg.product.price * 1_000_000),
              currency: pkg.product.currencyCode,
            });
          }
        }
        return plans;
      }),
    purchase: plan =>
      enqueue(async (): Promise<PurchaseOutcome> => {
        if (!loggedIn) {
          throw new Error('compra sem sessão: faça login antes');
        }
        try {
          await Purchases.purchasePackage(await packageFor(plan));
          return 'purchased';
        } catch (error) {
          if ((error as PurchasesError).userCancelled === true) {
            return 'cancelled';
          }
          throw error;
        }
      }),
    restore: () =>
      enqueue(async () => {
        if (!loggedIn) {
          throw new Error('restauração sem sessão: faça login antes');
        }
        const info = await Purchases.restorePurchases();
        return { hasPro: info.entitlements.active[ENTITLEMENT_ID] != null };
      }),
    managementUrl: () =>
      enqueue(async () => {
        if (!loggedIn) {
          return null;
        }
        return (await Purchases.getCustomerInfo()).managementURL ?? null;
      }),
  };
}
