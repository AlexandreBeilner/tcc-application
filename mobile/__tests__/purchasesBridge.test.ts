/**
 * @format
 */
import {
  buildNativeInfoScript,
  buildPurchasesResponseScript,
  handlePurchasesRequest,
  isAllowedManagementUrl,
  parsePurchasesRequest,
  PURCHASES_REQUEST_MESSAGE_TYPE,
  PURCHASES_RESPONSE_EVENT,
  userIdFromToken,
} from '../purchasesBridge';
import { PurchasesUnavailableError } from '../purchases/types';
import type { PurchasesService } from '../purchases/types';

const msg = (o: object) =>
  JSON.stringify({
    type: PURCHASES_REQUEST_MESSAGE_TYPE,
    requestId: 'r1',
    ...o,
  });

function fakeService(
  overrides: Partial<PurchasesService> = {},
): PurchasesService {
  return {
    logIn: jest.fn(),
    logOut: jest.fn(),
    listPlans: jest
      .fn()
      .mockResolvedValue([
        {
          id: 'monthly',
          formattedPrice: 'R$ 1',
          amountMicros: 1,
          currency: 'BRL',
        },
      ]),
    purchase: jest.fn().mockResolvedValue('purchased'),
    restore: jest.fn().mockResolvedValue({ hasPro: true }),
    managementUrl: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}
const effects = () => ({ openUrl: jest.fn().mockResolvedValue(undefined) });

describe('parsePurchasesRequest', () => {
  it.each([
    [msg({ op: 'plans' }), { requestId: 'r1', op: 'plans' }],
    [msg({ op: 'restore' }), { requestId: 'r1', op: 'restore' }],
    [
      msg({ op: 'purchase', plan: 'annual' }),
      { requestId: 'r1', op: 'purchase', plan: 'annual' },
    ],
    [
      msg({ op: 'manage', url: 'https://x' }),
      { requestId: 'r1', op: 'manage', url: 'https://x' },
    ],
    [msg({ op: 'manage' }), { requestId: 'r1', op: 'manage', url: null }],
  ])('reconhece %s', (data, expected) => {
    expect(parsePurchasesRequest(data)).toEqual(expected);
  });

  it.each([
    'não é json',
    '"texto"',
    'null',
    JSON.stringify({ type: 'outro', requestId: 'r', op: 'plans' }),
    msg({ op: 'purchase', plan: 'weekly' }),
    msg({ op: 'purchase' }),
    msg({ op: 'desconhecida' }),
    JSON.stringify({ type: PURCHASES_REQUEST_MESSAGE_TYPE, op: 'plans' }),
    msg({ requestId: '', op: 'plans' }),
  ])('rejeita %s', data => {
    expect(parsePurchasesRequest(data)).toBeNull();
  });
});

describe('handlePurchasesRequest', () => {
  it('plans devolve os planos da loja', async () => {
    const res = await handlePurchasesRequest(
      fakeService(),
      { requestId: 'r1', op: 'plans' },
      effects(),
    );
    expect(res).toMatchObject({ requestId: 'r1', op: 'plans', status: 'ok' });
    expect(res.plans?.[0].formattedPrice).toBe('R$ 1');
  });

  it('purchase ok e cancelada', async () => {
    const ok = await handlePurchasesRequest(
      fakeService(),
      { requestId: 'r1', op: 'purchase', plan: 'monthly' },
      effects(),
    );
    expect(ok.status).toBe('ok');
    const cancelled = await handlePurchasesRequest(
      fakeService({ purchase: jest.fn().mockResolvedValue('cancelled') }),
      { requestId: 'r1', op: 'purchase', plan: 'monthly' },
      effects(),
    );
    expect(cancelled.status).toBe('cancelled');
  });

  it('falha vira error/failed, sem lançar; build sem compras vira unavailable', async () => {
    const failed = await handlePurchasesRequest(
      fakeService({ purchase: jest.fn().mockRejectedValue(new Error('x')) }),
      { requestId: 'r1', op: 'purchase', plan: 'monthly' },
      effects(),
    );
    expect(failed).toMatchObject({ status: 'error', reason: 'failed' });
    const off = await handlePurchasesRequest(
      fakeService({
        listPlans: jest.fn().mockRejectedValue(new PurchasesUnavailableError()),
      }),
      { requestId: 'r1', op: 'plans' },
      effects(),
    );
    expect(off).toMatchObject({ status: 'error', reason: 'unavailable' });
  });

  it('restore informa se a loja devolveu PRO', async () => {
    const res = await handlePurchasesRequest(
      fakeService(),
      { requestId: 'r1', op: 'restore' },
      effects(),
    );
    expect(res).toMatchObject({ status: 'ok', hasPro: true });
  });

  it('manage prefere a URL do SDK; senão usa a da página se for de loja oficial', async () => {
    const e = effects();
    await handlePurchasesRequest(
      fakeService({
        managementUrl: jest
          .fn()
          .mockResolvedValue('https://apps.apple.com/sdk'),
      }),
      {
        requestId: 'r1',
        op: 'manage',
        url: 'https://play.google.com/store/account/subscriptions',
      },
      e,
    );
    expect(e.openUrl).toHaveBeenCalledWith('https://apps.apple.com/sdk');

    const e2 = effects();
    await handlePurchasesRequest(
      fakeService(),
      {
        requestId: 'r1',
        op: 'manage',
        url: 'https://play.google.com/store/account/subscriptions',
      },
      e2,
    );
    expect(e2.openUrl).toHaveBeenCalledWith(
      'https://play.google.com/store/account/subscriptions',
    );
  });

  it('manage recusa destino que não é página de loja', async () => {
    const e = effects();
    const res = await handlePurchasesRequest(
      fakeService(),
      { requestId: 'r1', op: 'manage', url: 'https://pagamento.exemplo.com' },
      e,
    );
    expect(res).toMatchObject({ status: 'error', reason: 'failed' });
    expect(e.openUrl).not.toHaveBeenCalled();
  });
});

describe('isAllowedManagementUrl', () => {
  it.each([
    ['https://apps.apple.com/account/subscriptions', true],
    ['https://play.google.com/store/account/subscriptions', true],
    ['http://play.google.com/x', false],
    ['https://play.google.com.evil.com/x', false],
    ['ftp://apps.apple.com/x', false],
    ['lixo', false],
  ])('%s -> %s', (url, expected) => {
    expect(isAllowedManagementUrl(url)).toBe(expected);
  });
});

describe('scripts', () => {
  it('resposta vira um evento com o JSON como string literal', () => {
    const script = buildPurchasesResponseScript({
      requestId: 'r1',
      op: 'plans',
      status: 'ok',
    });
    expect(script).toContain(PURCHASES_RESPONSE_EVENT);
    expect(script).toContain('JSON.parse("{\\"requestId\\":\\"r1\\"');
  });

  it('expõe a plataforma ao SPA', () => {
    expect(buildNativeInfoScript('ios')).toContain('{ platform: "ios" }');
  });
});

describe('userIdFromToken', () => {
  const token = (claims: object) =>
    `h.${(globalThis as unknown as { btoa: (s: string) => string })
      .btoa(JSON.stringify(claims))
      .split('=')[0]
      .replace(/\+/g, '-')
      .replace(/[/]/g, '_')}.s`;

  it('lê o sub', () => {
    expect(userIdFromToken(token({ sub: 'uuid-1', role: 'user' }))).toBe(
      'uuid-1',
    );
  });

  it.each([null, '', 'sem-pontos', 'h.%%%.s', token({}), token({ sub: 5 })])(
    'devolve null para %s',
    t => {
      expect(userIdFromToken(t as string | null)).toBeNull();
    },
  );
});
