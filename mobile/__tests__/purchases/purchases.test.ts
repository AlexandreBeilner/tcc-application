/**
 * @format
 */
import Purchases from 'react-native-purchases';
import { createFakePurchases } from '../../purchases/fakePurchases';
import { createPurchasesService } from '../../purchases';
import { createRevenueCatPurchases } from '../../purchases/revenueCatPurchases';
import { PurchasesUnavailableError } from '../../purchases/types';

const rc = Purchases as unknown as Record<string, jest.Mock>;

const baseConfig = {
  mode: 'fake' as string | undefined,
  platform: 'android' as const,
  isDev: true,
  apiBaseUrl: 'http://api',
  androidApiKey: undefined,
  iosApiKey: undefined,
  getToken: () => 'tok',
};

beforeEach(() => jest.clearAllMocks());

describe('createFakePurchases', () => {
  function build(response: { ok: boolean; status?: number; json?: unknown } = { ok: true }) {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? 200,
      json: async () => response.json,
    });
    const service = createFakePurchases({
      apiBaseUrl: 'http://api',
      platform: 'android',
      getToken: () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return { service, fetchImpl };
  }

  it('planos fixos marcados como teste', async () => {
    const plans = await build().service.listPlans();
    expect(plans.map(p => p.id)).toEqual(['monthly', 'annual']);
    expect(plans.every(p => p.formattedPrice.includes('(teste)'))).toBe(true);
  });

  it('compra grava pela rota de dev com a loja da plataforma e o token', async () => {
    const { service, fetchImpl } = build();
    await service.logIn('u1');
    expect(await service.purchase('annual')).toBe('purchased');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api/billing/dev/purchase');
    expect(JSON.parse(init.body)).toEqual({ plan: 'annual', store: 'play_store' });
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('sem login a compra falha, sem chamar o backend', async () => {
    const { service, fetchImpl } = build();
    await expect(service.purchase('monthly')).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('erro HTTP da rota vira falha', async () => {
    const { service } = build({ ok: false, status: 404 });
    await service.logIn('u1');
    await expect(service.purchase('monthly')).rejects.toThrow(/404/);
  });

  it('restaurar consulta o status', async () => {
    const { service } = build({ ok: true, json: { isPro: true } });
    await service.logIn('u1');
    expect(await service.restore()).toEqual({ hasPro: true });
  });
});

describe('createPurchasesService', () => {
  it('fake em debug devolve a implementação falsa', async () => {
    const plans = await createPurchasesService(baseConfig).listPlans();
    expect(plans[0].formattedPrice).toContain('(teste)');
  });

  it('fake fora de __DEV__ nunca vira compra falsa', async () => {
    await expect(createPurchasesService({ ...baseConfig, isDev: false }).listPlans()).rejects.toBeInstanceOf(
      PurchasesUnavailableError,
    );
  });

  it('revenuecat com chave em branco fica indisponível', async () => {
    await expect(
      createPurchasesService({ ...baseConfig, mode: 'revenuecat' }).purchase('monthly'),
    ).rejects.toBeInstanceOf(PurchasesUnavailableError);
    expect(rc.configure).not.toHaveBeenCalled();
  });

  it('revenuecat usa a chave da plataforma', async () => {
    const service = createPurchasesService({ ...baseConfig, mode: 'revenuecat', platform: 'ios', iosApiKey: 'appl_x', androidApiKey: 'goog_y' });
    await service.logIn('u1');
    expect(rc.configure).toHaveBeenCalledWith({ apiKey: 'appl_x' });
  });
});

describe('createRevenueCatPurchases', () => {
  const pkg = (price: number, priceString: string) => ({
    product: { price, priceString, currencyCode: 'BRL' },
  });

  it('logIn configura uma vez e identifica pelo id do usuário', async () => {
    const service = createRevenueCatPurchases({ apiKey: 'k' });
    await service.logIn('u1');
    await service.logIn('u2');
    expect(rc.configure).toHaveBeenCalledTimes(1);
    expect(rc.logIn).toHaveBeenNthCalledWith(1, 'u1');
    expect(rc.logIn).toHaveBeenNthCalledWith(2, 'u2');
  });

  it('lista os pacotes mensal e anual com o preço da loja', async () => {
    rc.getOfferings.mockResolvedValueOnce({ current: { monthly: pkg(19.9, 'R$ 19,90'), annual: pkg(199.9, 'R$ 199,90') } });
    const plans = await createRevenueCatPurchases({ apiKey: 'k' }).listPlans();
    expect(plans).toEqual([
      { id: 'monthly', formattedPrice: 'R$ 19,90', amountMicros: 19_900_000, currency: 'BRL' },
      { id: 'annual', formattedPrice: 'R$ 199,90', amountMicros: 199_900_000, currency: 'BRL' },
    ]);
  });

  it('não compra como anônimo', async () => {
    await expect(createRevenueCatPurchases({ apiKey: 'k' }).purchase('monthly')).rejects.toThrow();
    expect(rc.purchasePackage).not.toHaveBeenCalled();
  });

  it('compra o pacote certo; cancelamento do usuário não é erro', async () => {
    const monthly = pkg(19.9, 'R$ 19,90');
    rc.getOfferings.mockResolvedValue({ current: { monthly, annual: null } });
    const service = createRevenueCatPurchases({ apiKey: 'k' });
    await service.logIn('u1');
    expect(await service.purchase('monthly')).toBe('purchased');
    expect(rc.purchasePackage).toHaveBeenCalledWith(monthly);

    rc.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect(await service.purchase('monthly')).toBe('cancelled');

    rc.purchasePackage.mockRejectedValueOnce(new Error('falha'));
    await expect(service.purchase('monthly')).rejects.toThrow('falha');
  });

  it('pacote ausente do Offering é erro', async () => {
    rc.getOfferings.mockResolvedValue({ current: { monthly: null, annual: null } });
    const service = createRevenueCatPurchases({ apiKey: 'k' });
    await service.logIn('u1');
    await expect(service.purchase('annual')).rejects.toThrow(/annual/);
  });

  it('restaurar diz se há direito pro ativo', async () => {
    const service = createRevenueCatPurchases({ apiKey: 'k' });
    await service.logIn('u1');
    expect(await service.restore()).toEqual({ hasPro: false });
    rc.restorePurchases.mockResolvedValueOnce({ entitlements: { active: { pro: {} } } });
    expect(await service.restore()).toEqual({ hasPro: true });
  });

  it('logOut sem login é no-op; depois do login chama o SDK', async () => {
    const service = createRevenueCatPurchases({ apiKey: 'k' });
    await service.logOut();
    expect(rc.logOut).not.toHaveBeenCalled();
    await service.logIn('u1');
    await service.logOut();
    expect(rc.logOut).toHaveBeenCalledTimes(1);
  });

  it('managementUrl vem do customerInfo', async () => {
    rc.getCustomerInfo.mockResolvedValueOnce({ managementURL: 'https://apps.apple.com/x' });
    const service = createRevenueCatPurchases({ apiKey: 'k' });
    await service.logIn('u1');
    expect(await service.managementUrl()).toBe('https://apps.apple.com/x');
  });
});
