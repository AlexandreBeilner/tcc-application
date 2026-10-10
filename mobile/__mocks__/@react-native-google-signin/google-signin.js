// Mock manual pro Jest — o módulo nativo real (Play Services/GIDSignIn) não
// existe fora de um app rodando de verdade num dispositivo/emulador. Mesma
// mecânica de __mocks__/react-native-keychain.js. Testes que precisam de um
// resultado específico usam `GoogleSignin.signIn.mockResolvedValueOnce(...)`
// etc.
export const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn(),
};
