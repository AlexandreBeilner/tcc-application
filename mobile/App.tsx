/**
 * Casca WebView do app mobile — carrega o SPA (frontend/) já existente.
 * Navegação nativa (botão voltar, links externos) é a tarefa 1.3, implementada
 * aqui; tela de erro/offline é a 1.4. URL variando por build
 * (Config.APP_WEB_URL, .env.debug/.env.release via react-native-config).
 *
 * @format
 */

import { useCallback, useEffect, useRef } from 'react';
import Config from 'react-native-config';
import {
  BackHandler,
  Linking,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView, WebViewHandle } from 'react-native-webview';

const APP_WEB_URL = Config.APP_WEB_URL as string;

// originWhitelist entende cada entrada como regex — escapa os caracteres
// especiais da URL (o ":" e "." de "http://10.0.2.2:5173", por exemplo) antes
// de anexar o coringa que libera qualquer caminho dentro da mesma origem.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ORIGIN_WHITELIST = [`${escapeRegExp(APP_WEB_URL)}.*`];

// Só a origem do frontend entra aqui: chamada de API (fetch/XHR pro gateway)
// não passa por onShouldStartLoadWithRequest, é o CORS do próprio navegador
// embutido no WebView que resolve isso — este filtro é só pra navegação de
// página (troca de URL top-level), não pra requisição de dados.
function isWithinAppOrigin(url: string): boolean {
  return url.startsWith(APP_WEB_URL);
}

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
  const webviewRef = useRef<WebViewHandle>(null);
  // Ref (não state) de propósito: o listener do botão físico é registrado
  // uma vez só (useEffect com deps vazias) e precisa ler o valor mais recente
  // sem forçar re-registro a cada navegação do SPA.
  const canGoBackRef = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (canGoBackRef.current) {
          webviewRef.current?.goBack();
          return true;
        }

        // Sem pra onde voltar dentro do SPA: sai do app direto, sem tela de
        // confirmação (decisão do autor, 2026-09-10) — devolver false deixa
        // o comportamento padrão do Android (fechar a activity) acontecer.
        return false;
      },
    );

    return () => subscription.remove();
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      if (isWithinAppOrigin(request.url)) {
        return true;
      }

      // Link externo (ex. termos de uso): abre no navegador do sistema em
      // vez de ficar preso dentro do WebView — evita o app virar um
      // "navegador disfarçado" (risco de rejeição Apple, Guideline 4.2).
      if (/^https?:\/\//.test(request.url)) {
        Linking.openURL(request.url);
      }

      return false;
    },
    [],
  );

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
        ref={webviewRef}
        source={{ uri: APP_WEB_URL }}
        style={styles.webview}
        domStorageEnabled
        javaScriptEnabled
        mixedContentMode="never"
        originWhitelist={ORIGIN_WHITELIST}
        allowsBackForwardNavigationGestures
        onNavigationStateChange={navState => {
          canGoBackRef.current = navState.canGoBack;
        }}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
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
