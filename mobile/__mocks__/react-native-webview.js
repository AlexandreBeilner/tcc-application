// Mock manual pro Jest — o módulo nativo real (TurboModule) não existe fora
// de um app rodando de verdade num dispositivo/emulador, então testes de
// unidade/smoke precisam de um stub. Mesma mecânica de
// __mocks__/react-native-config.js: arquivo em __mocks__/<pacote>.js na raiz
// é aplicado automaticamente pro pacote de node_modules correspondente.
import { View } from 'react-native';

export const WebView = View;
export default WebView;
