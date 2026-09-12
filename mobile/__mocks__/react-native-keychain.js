// Mock manual pro Jest — o módulo nativo real (Keychain/Keystore) não existe
// fora de um app rodando de verdade num dispositivo/emulador. Mesma mecânica
// de __mocks__/react-native-webview.js: arquivo em __mocks__/<pacote>.js na
// raiz é aplicado automaticamente pro pacote de node_modules correspondente.
// Testes que precisam de um valor específico usam
// `keychainMock.getGenericPassword.mockResolvedValueOnce(...)` etc.
export const getGenericPassword = jest.fn().mockResolvedValue(false);
export const setGenericPassword = jest.fn().mockResolvedValue(false);
export const resetGenericPassword = jest.fn().mockResolvedValue(true);

export default {
  getGenericPassword,
  setGenericPassword,
  resetGenericPassword,
};
