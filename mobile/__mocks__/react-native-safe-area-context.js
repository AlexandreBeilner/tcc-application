// Mock manual pro Jest — reexporta o mock oficial da lib
// (react-native-safe-area-context/jest/mock) como named exports. Sem isso,
// <SafeAreaProvider> real depende de medição nativa que não existe em
// ambiente Jest e nunca resolve métricas iniciais, então nunca renderiza os
// filhos — <AppContent> (e o <WebView> dentro dela) não apareceria na
// árvore de teste. Mesma mecânica de mock automático de node_modules dos
// outros arquivos deste diretório (__mocks__/react-native-config.js,
// __mocks__/react-native-webview.js): arquivo em __mocks__/<pacote>.js na
// raiz é aplicado automaticamente, sem precisar de jest.mock() em cada
// teste.
module.exports = require('react-native-safe-area-context/jest/mock').default;
