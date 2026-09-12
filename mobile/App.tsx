/**
 * Casca WebView do app mobile — carrega o SPA (frontend/) já existente.
 * Navegação nativa (botão voltar, links externos) é a tarefa 1.3; tela de
 * erro/offline é a 1.4. Aqui só o WebView em si, com a URL variando por
 * build (Config.APP_WEB_URL, .env.debug/.env.release via react-native-config).
 *
 * @format
 */

import Config from 'react-native-config';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  // Renderização edge-to-edge é o default do RN 0.87 (AgpConfiguratorUtils
  // do RN Gradle Plugin) — sem esse padding, o SPA carrega por baixo da
  // status bar (TopBar cortada) e, mais grave, por baixo da barra de
  // navegação 3-botões do Android: a TabBar do próprio SPA fica exatamente
  // na área que o sistema intercepta pros botões físicos, e nenhum toque
  // chega no WebView (achado ao validar a navegação por abas nesta sessão).
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <WebView
        source={{ uri: Config.APP_WEB_URL as string }}
        style={styles.webview}
        domStorageEnabled
        javaScriptEnabled
        mixedContentMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // --color-bg-base (tema dark), identidade-visual-tokens.md — evita um
    // "flash" claro na faixa de inset enquanto o WebView ainda carrega.
    backgroundColor: '#0E0F13',
  },
  webview: {
    flex: 1,
  },
});

export default App;
