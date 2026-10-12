// Mock manual pro Jest: o módulo nativo do RevenueCat não existe fora de um app rodando. Os
// testes do adaptador real (purchases/revenueCatPurchases.test.ts) ajustam estas funções.
const Purchases = {
  configure: jest.fn(),
  logIn: jest.fn().mockResolvedValue({ customerInfo: {}, created: false }),
  logOut: jest.fn().mockResolvedValue({}),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  purchasePackage: jest.fn().mockResolvedValue({}),
  restorePurchases: jest
    .fn()
    .mockResolvedValue({ entitlements: { active: {} } }),
  getCustomerInfo: jest.fn().mockResolvedValue({ managementURL: null }),
};

export default Purchases;
