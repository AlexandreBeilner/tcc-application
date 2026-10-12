/**
 * Ponte WebView <-> compra nativa (MO.4.2/MO.4.3). O SPA (dentro do app) nunca abre checkout web:
 * pede ao app, por `postMessage`, que liste planos, compre, restaure ou abra o gerenciamento da
 * loja, e recebe a resposta como um evento `window` com o mesmo `requestId`. Funções puras e
 * testáveis aqui; efeitos (SDK, Linking, injectJavaScript) ficam em App.tsx e em `purchases/`.
 * Desvio do enunciado `{ type: 'purchase', plan }`: um único tipo namespaced com campo `op`
 * (`plans|purchase|restore|manage`), no mesmo padrão das outras pontes.
 *
 * @format
 */
import { PurchasesUnavailableError } from './purchases/types';
import type { PlanId, PurchasesService, StorePlan } from './purchases/types';

export const PURCHASES_REQUEST_MESSAGE_TYPE = 'selucra:purchases-request';
// Nome do evento `window` que o SPA escuta (a resposta nunca é um novo postMessage do WebView).
export const PURCHASES_RESPONSE_EVENT = 'selucra:purchases-response';

export type PurchasesRequest =
  | { requestId: string; op: 'plans' }
  | { requestId: string; op: 'purchase'; plan: PlanId }
  | { requestId: string; op: 'restore' }
  | { requestId: string; op: 'manage'; url: string | null };

export interface PurchasesResponse {
  requestId: string;
  op: PurchasesRequest['op'];
  status: 'ok' | 'cancelled' | 'error';
  plans?: StorePlan[];
  // restore: a loja devolveu um direito ativo.
  hasPro?: boolean;
  // error: `unavailable` = build sem compras (chave em branco); `failed` = falha na operação.
  reason?: 'unavailable' | 'failed';
}

// Só páginas oficiais de assinaturas das lojas: o app não vira um "abre qualquer link" a pedido
// de uma página.
const MANAGEMENT_HOSTS = ['apps.apple.com', 'play.google.com'];

export function isAllowedManagementUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' && MANAGEMENT_HOSTS.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function parsePurchasesRequest(data: string): PurchasesRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const c = parsed as {
    type?: unknown;
    requestId?: unknown;
    op?: unknown;
    plan?: unknown;
    url?: unknown;
  };
  if (c.type !== PURCHASES_REQUEST_MESSAGE_TYPE) {
    return null;
  }
  if (typeof c.requestId !== 'string' || c.requestId.length === 0) {
    return null;
  }
  const requestId = c.requestId;
  switch (c.op) {
    case 'plans':
    case 'restore':
      return { requestId, op: c.op };
    case 'purchase':
      return c.plan === 'monthly' || c.plan === 'annual'
        ? { requestId, op: 'purchase', plan: c.plan }
        : null;
    case 'manage':
      return {
        requestId,
        op: 'manage',
        url: typeof c.url === 'string' ? c.url : null,
      };
    default:
      return null;
  }
}

export interface PurchasesRequestEffects {
  openUrl: (url: string) => Promise<unknown>;
}

// Executa o pedido e devolve a resposta; nunca lança (um erro vira `status: 'error'`).
export async function handlePurchasesRequest(
  service: PurchasesService,
  request: PurchasesRequest,
  effects: PurchasesRequestEffects,
): Promise<PurchasesResponse> {
  const base = { requestId: request.requestId, op: request.op };
  try {
    switch (request.op) {
      case 'plans':
        return { ...base, status: 'ok', plans: await service.listPlans() };
      case 'purchase': {
        const outcome = await service.purchase(request.plan);
        return { ...base, status: outcome === 'cancelled' ? 'cancelled' : 'ok' };
      }
      case 'restore':
        return { ...base, status: 'ok', hasPro: (await service.restore()).hasPro };
      case 'manage': {
        const url =
          (await service.managementUrl()) ??
          (request.url && isAllowedManagementUrl(request.url)
            ? request.url
            : null);
        if (!url) {
          return { ...base, status: 'error', reason: 'failed' };
        }
        await effects.openUrl(url);
        return { ...base, status: 'ok' };
      }
    }
  } catch (error) {
    return {
      ...base,
      status: 'error',
      reason: error instanceof PurchasesUnavailableError ? 'unavailable' : 'failed',
    };
  }
}

// O JSON entra no script como string literal (dupla serialização), seguro contra qualquer
// caractere no conteúdo.
export function buildPurchasesResponseScript(
  response: PurchasesResponse,
): string {
  return `
(function () {
  try {
    window.dispatchEvent(new CustomEvent(${JSON.stringify(
      PURCHASES_RESPONSE_EVENT,
    )}, { detail: JSON.parse(${JSON.stringify(JSON.stringify(response))}) }));
  } catch (e) {}
})();
true;
`;
}

// Plataforma do app para o SPA (decide, por exemplo, que loja é "a deste aparelho"). Roda antes do
// SPA montar.
export function buildNativeInfoScript(platform: 'android' | 'ios'): string {
  return `
(function () {
  window.__selucraNative = { platform: ${JSON.stringify(platform)} };
})();
true;
`;
}

// `sub` do JWT da aplicação (= `users.id`, o `app_user_id` do RevenueCat). Só leitura do payload,
// sem verificar assinatura: quem confia no token é o backend; aqui só se escolhe com que id fazer
// logIn no SDK.
export function userIdFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(
      (globalThis as unknown as { atob: (data: string) => string }).atob(padded),
    ) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}
