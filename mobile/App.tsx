/**
 * Casca WebView do app mobile — carrega o SPA (frontend/) já existente.
 * Navegação nativa (botão voltar, links externos) é a tarefa 1.3; tela de
 * erro/offline (renderError) é a 1.4; ponte de sessão pro Keychain/Keystore
 * é a 2.1, todas implementadas aqui. URL variando por build
 * (Config.APP_WEB_URL, .env.debug/.env.release via react-native-config).
 *
 * @format
 */

import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Config from 'react-native-config';
import Keychain from 'react-native-keychain';
import {
  BackHandler,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView, WebViewHandle, WebViewMessageEvent } from 'react-native-webview';
import {
  buildAuthTokenReinjectionScript,
  buildAuthWatcherScript,
  parseAuthTokenChangedMessage,
} from './sessionBridge';

// Escopa as credenciais no Keychain/Keystore pra esse app específico — sem
// isso o react-native-keychain usa um serviço default compartilhado entre
// apps que reusarem a lib no mesmo dispositivo (irrelevante em produção, mas
// evita colisão durante desenvolvimento local).
export const AUTH_KEYCHAIN_SERVICE = 'br.com.investimenta.auth';

const APP_WEB_URL = Config.APP_WEB_URL as string;

// react-native-webview NÃO aceita uma regex pronta aqui: cada entrada é uma
// string estilo wildcard (mesmo formato do defaultOriginWhitelist da lib,
// ['http://*', 'https://*']) que a própria lib escapa por inteiro
// (escape-string-regexp) antes de expandir só o "*" literal pra ".*"
// (WebViewShared.tsx, originWhitelistToRegex). Passar uma regex já escapada
// por nós (como antes: `${escapeRegExp(APP_WEB_URL)}.*`) causa duplo escape —
// o "\." que nós inserimos vira "\\." depois de passar pelo escape da lib, e
// o resultado não bate nem com a própria origem, derrubando toda navegação
// top-level (inclusive same-origin) pro browser externo via Linking.openURL,
// silenciosamente, porque isso só afeta navegação de página real, nunca a
// navegação client-side (pushState) do SPA usada na validação manual das
// tarefas 1.2/1.3. Bug encontrado na revisão desta fase — corrigido passando
// a URL crua com um "*" literal, no mesmo formato que a lib espera.
export const ORIGIN_WHITELIST = [`${APP_WEB_URL}*`];

// Só a origem do frontend entra aqui: chamada de API (fetch/XHR pro gateway)
// não passa por onShouldStartLoadWithRequest, é o CORS do próprio navegador
// embutido no WebView que resolve isso — este filtro é só pra navegação de
// página (troca de URL top-level), não pra requisição de dados.
//
// Comparação de origem exata (scheme+host+port) via URL.origin, não
// "startsWith" — um "startsWith" seria enganável por um host tipo
// "https://app.investimenta.com.br.evil.com", que também começa com a
// string da origem legítima como prefixo literal.
export function isWithinAppOrigin(url: string): boolean {
  try {
    return new URL(url).origin === new URL(APP_WEB_URL).origin;
  } catch {
    return false;
  }
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

  // Cópia autoritativa do token vive no Keychain/Keystore (tarefa 2.1) — o
  // React só guarda em state o valor necessário pra montar o script de
  // reinjeção (injectedJavaScriptBeforeContentLoaded) do próximo
  // carregamento do WebView. isSessionReady evita montar o WebView com um
  // script de reinjeção "vazio" (token ainda null) antes da leitura
  // assíncrona do Keychain terminar — sem isso, uma sessão que sobreviveu
  // no Keychain mas foi apagada do localStorage (ex. iOS sob pressão de
  // armazenamento) não seria restaurada a tempo do primeiro carregamento.
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Keychain.getGenericPassword({ service: AUTH_KEYCHAIN_SERVICE })
      .then(credentials => {
        if (!cancelled && credentials) {
          setAuthToken(credentials.password);
        }
      })
      .catch(() => {
        // Leitura do Keychain falhando (ex. hardware seguro indisponível)
        // não pode travar o app — segue sem sessão restaurada, o SPA volta
        // a pedir login normalmente.
      })
      .finally(() => {
        if (!cancelled) {
          setIsSessionReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseAuthTokenChangedMessage(event.nativeEvent.data);
    if (!message) {
      return;
    }

    if (message.token) {
      Keychain.setGenericPassword('investimenta', message.token, {
        service: AUTH_KEYCHAIN_SERVICE,
      }).catch(() => {});
    } else {
      // Token removido do localStorage (logout dentro do SPA) — limpa o
      // Keychain também, senão a reinjeção do próximo carregamento traria o
      // token de volta e o logout não "colaria" na próxima abertura do app.
      Keychain.resetGenericPassword({ service: AUTH_KEYCHAIN_SERVICE }).catch(
        () => {},
      );
    }

    setAuthToken(message.token);
  }, []);

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

  // renderError substitui o conteúdo do WebView por essa tela sempre que o
  // carregamento do frame principal falha (rede fora do ar, backend down) —
  // sem isso o usuário vê a tela de erro genérica do sistema (ou branca),
  // citada como sinal de "lazy wrapper" na revisão da Apple (Guideline 4.2).
  // Volta a mostrar o WebView normal sozinho assim que reload() funcionar.
  const renderError = useCallback(
    (): ReactElement => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Sem conexão</Text>
        <Text style={styles.errorMessage}>
          Não foi possível carregar o Investimenta. Verifique sua conexão e
          tente novamente.
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => webviewRef.current?.reload()}
        >
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    ),
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
      {isSessionReady && (
        <WebView
          ref={webviewRef}
          source={{ uri: APP_WEB_URL }}
          style={styles.webview}
          domStorageEnabled
          javaScriptEnabled
          mixedContentMode="never"
          originWhitelist={ORIGIN_WHITELIST}
          allowsBackForwardNavigationGestures
          injectedJavaScript={buildAuthWatcherScript()}
          injectedJavaScriptBeforeContentLoaded={buildAuthTokenReinjectionScript(
            authToken,
          )}
          onMessage={handleMessage}
          onNavigationStateChange={navState => {
            canGoBackRef.current = navState.canGoBack;
          }}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          renderError={renderError}
        />
      )}
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
  errorContainer: {
    // react-native-webview renderiza otherView (o retorno de renderError)
    // como irmão do WebView nativo dentro do mesmo container flex, não como
    // substituto — sem position: 'absolute' cobrindo 100%, essa tela aparece
    // empilhada ABAIXO da própria página de erro nativa do Android/Chromium
    // (a "Webpage not available" branca, que o engine pinta como conteúdo
    // "carregado com sucesso" e nenhum callback da lib consegue suprimir),
    // em vez de escondê-la. Mesmo padrão de position que a lib usa no seu
    // próprio defaultRenderError (WebView.styles.ts, loadingOrErrorView).
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    // --color-bg-base (tema dark), identidade-visual-tokens.md.
    backgroundColor: '#0E0F13',
  },
  errorTitle: {
    // --color-text-primary (tema dark).
    color: '#F5F6F8',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    // --color-text-secondary (tema dark).
    color: '#9BA1AE',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    // --color-brand-500 (tema dark), ação primária.
    backgroundColor: '#2F6FED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#F5F6F8',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
