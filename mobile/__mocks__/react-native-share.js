// Mock manual pro Jest — o módulo nativo real (ACTION_SEND/FileProvider) não
// existe fora de um app rodando de verdade num dispositivo/emulador. Mesma
// mecânica de __mocks__/react-native-webview.js e __mocks__/react-native-
// keychain.js: arquivo em __mocks__/<pacote>.js na raiz é aplicado
// automaticamente pro pacote de node_modules correspondente.
const open = jest.fn().mockResolvedValue({ success: true });

export default {
  open,
};
