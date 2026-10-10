/**
 * Camada de compras do app (MO.4.1): tudo que o resto do app sabe sobre assinatura passa por esta
 * interface. A implementação real fala com o RevenueCat (`react-native-purchases`); em debug uma
 * implementação falsa grava uma assinatura de teste no banco de dev. Nenhum código fora de
 * `purchases/` importa o SDK.
 *
 * @format
 */

export type PlanId = 'monthly' | 'annual';

// Um plano com o preço que a LOJA devolveu (as lojas exigem mostrar o preço delas, nunca um valor
// nosso).
export interface StorePlan {
  id: PlanId;
  formattedPrice: string;
  amountMicros: number;
  currency: string;
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

export interface PurchasesService {
  // `app_user_id` do RevenueCat = `users.id`. Nunca se compra como anônimo.
  logIn(userId: string): Promise<void>;
  logOut(): Promise<void>;
  listPlans(): Promise<StorePlan[]>;
  purchase(plan: PlanId): Promise<PurchaseOutcome>;
  // `hasPro`: a loja devolveu um direito ativo (o servidor ainda confirma pelo webhook).
  restore(): Promise<{ hasPro: boolean }>;
  // Destino de gerenciar que o próprio SDK conhece (específico da pessoa); `null` se não souber.
  managementUrl(): Promise<string | null>;
}

// Compras fora do ar neste build (chave do RevenueCat em branco, ou modo falso fora do debug).
export class PurchasesUnavailableError extends Error {
  constructor(message = 'compras indisponíveis neste build') {
    super(message);
    this.name = 'PurchasesUnavailableError';
  }
}
