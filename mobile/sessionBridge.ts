/**
 * Ponte de sessão entre o localStorage do SPA (rodando dentro do WebView) e
 * o armazenamento seguro nativo (react-native-keychain) — tarefa 2.1 do
 * backlog de app mobile, arquitetura-app-mobile-react-native-webview.md §8.
 * Funções puras/testáveis aqui; efeitos colaterais (Keychain, postMessage,
 * setState) ficam em App.tsx.
 *
 * @format
 */

// Mesma chave "current" de `authToken` em frontend/src/utils/storage/index.ts
// — não há import cross-package entre mobile/ e frontend/, então as duas
// precisam ficar sincronizadas manualmente. Era 'tcc.auth.token' até a RC.1.4
// renomear a chave do SPA (a antiga virou `legacy`); sem acompanhar, a ponte
// deixou de enxergar o login e o Keychain nunca recebia o token (achado ao
// validar a MO.4.1 no emulador).
export const AUTH_TOKEN_STORAGE_KEY = 'app.auth.token';

export const AUTH_TOKEN_CHANGED_MESSAGE_TYPE =
  'investimenta:auth-token-changed';

export interface AuthTokenChangedMessage {
  type: typeof AUTH_TOKEN_CHANGED_MESSAGE_TYPE;
  token: string | null;
}

/**
 * injectedJavaScript: roda uma vez por carregamento completo de página (ou
 * seja, uma vez por instância do WebView) e instala um watcher que sobrevive
 * a toda navegação client-side subsequente do SPA. Usa polling em vez de
 * depender de onNavigationStateChange do lado nativo porque o React Router
 * navega via pushState, que não dispara esse callback de forma confiável —
 * o poll cobre login (token aparece) e logout (token some) com o mesmo
 * mecanismo, sem exigir nenhuma mudança no frontend/.
 */
export function buildAuthWatcherScript(): string {
  return `
(function () {
  if (window.__investimentaAuthWatcherInstalled) { return; }
  window.__investimentaAuthWatcherInstalled = true;
  var KEY = ${JSON.stringify(AUTH_TOKEN_STORAGE_KEY)};
  var MESSAGE_TYPE = ${JSON.stringify(AUTH_TOKEN_CHANGED_MESSAGE_TYPE)};
  var lastValue = localStorage.getItem(KEY);
  // Sessão que já existia ao carregar a página (SPA logado antes do app abrir): avisa o lado nativo
  // uma vez, senão o app só descobriria o login na próxima mudança (e a camada de compras, que
  // precisa do id do usuário para o logIn, ficaria sem sessão).
  if (lastValue) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: MESSAGE_TYPE, token: lastValue })
    );
  }
  setInterval(function () {
    var current = localStorage.getItem(KEY);
    if (current !== lastValue) {
      lastValue = current;
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: MESSAGE_TYPE, token: current })
      );
    }
  }, 1000);
})();
true;
`;
}

/**
 * injectedJavaScriptBeforeContentLoaded: roda antes do SPA montar, em toda
 * nova instância/reload do WebView — é o que garante que a sessão sobrevive
 * mesmo que o sistema (principalmente iOS, sob pressão de armazenamento)
 * tenha apagado o localStorage do WebView por baixo. `token` nulo/vazio
 * produz um script vazio (sem sessão salva, nada a reinjetar).
 */
export function buildAuthTokenReinjectionScript(token: string | null): string {
  if (!token) {
    return '';
  }

  return `
(function () {
  try {
    localStorage.setItem(
      ${JSON.stringify(AUTH_TOKEN_STORAGE_KEY)},
      ${JSON.stringify(token)}
    );
  } catch (e) {}
})();
true;
`;
}

/**
 * Parseia o payload de onMessage do WebView. Retorna null pra qualquer coisa
 * que não seja uma mudança de token reconhecida — uma mensagem malformada ou
 * de outra origem não pode derrubar o app nativo.
 */
export function parseAuthTokenChangedMessage(
  data: string,
): AuthTokenChangedMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const candidate = parsed as { type?: unknown; token?: unknown };
  if (candidate.type !== AUTH_TOKEN_CHANGED_MESSAGE_TYPE) {
    return null;
  }
  if (typeof candidate.token !== 'string' && candidate.token !== null) {
    return null;
  }

  return { type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE, token: candidate.token };
}
