/**
 * Ponte de gatilho pro login Google nativo — tarefa 3.3 do backlog de app
 * mobile, arquitetura-app-mobile-react-native-webview.md §7. A tela de login
 * do SPA (`frontend/src/pages/Login/index.tsx`) já tem
 * `<a href={googleLoginUrl()}>Entrar com Google</a>`, que hoje navegaria pro
 * redirect web (`GET /auth/google`) — bloqueado pelo Google dentro de WebView
 * desde 2021 (`disallowed_useragent`). Sem modificar o frontend/: intercepta
 * o clique nesse link antes da navegação acontecer e avisa o lado nativo, que
 * é quem de fato chama o SDK do Google (`App.tsx`) — a chamada ao SDK nunca
 * pode rodar dentro do WebView. Funções puras/testáveis aqui; efeito
 * colateral (GoogleSignin, fetch, Keychain, injectJavaScript) fica em
 * App.tsx, mesma divisão de sessionBridge.ts/downloadBridge.ts.
 *
 * @format
 */

export const GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE =
  'investimenta:google-signin-requested';

export interface GoogleSignInRequestedMessage {
  type: typeof GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE;
}

/**
 * injectedJavaScript: instala um listener de `click` em fase de captura no
 * `document` (mesma técnica de `downloadBridge.buildDownloadInterceptorScript`)
 * que detecta cliques em qualquer `<a>` cujo caminho resolvido seja
 * `/auth/google` — comparação por `pathname` (via `new URL`), não por `href`
 * cru, pra funcionar tanto com o link relativo (`/auth/google`, quando
 * `API_BASE_URL` do frontend é vazio e o próprio proxy do Vite encaminha pro
 * gateway) quanto absoluto (`http://<gateway>/auth/google`, se
 * `VITE_GATEWAY_URL` estiver configurado) — o path final é sempre o mesmo
 * nos dois casos. `/auth/google/callback` (só alcançável via redirect do
 * próprio Google, nunca um link clicável do SPA) não bate com essa
 * comparação exata, então não corre risco de interceptar à toa.
 */
export function buildGoogleSignInInterceptorScript(): string {
  return `
(function () {
  if (window.__investimentaGoogleSignInInterceptorInstalled) { return; }
  window.__investimentaGoogleSignInInterceptorInstalled = true;
  var MESSAGE_TYPE = ${JSON.stringify(GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE)};

  document.addEventListener('click', function (event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor) { return; }

    var path;
    try {
      path = new URL(anchor.getAttribute('href'), window.location.href).pathname;
    } catch (e) {
      return;
    }
    if (path !== '/auth/google') { return; }

    event.preventDefault();
    event.stopImmediatePropagation();

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: MESSAGE_TYPE }));
  }, true);
})();
true;
`;
}

/**
 * Parseia o payload de onMessage do WebView. Retorna null pra qualquer coisa
 * que não seja essa mensagem específica — mesma disciplina de
 * `sessionBridge.parseAuthTokenChangedMessage`/`downloadBridge.parseFileDownloadMessage`,
 * uma mensagem malformada ou de outra origem não pode derrubar o app nativo.
 */
export function parseGoogleSignInRequestedMessage(
  data: string,
): GoogleSignInRequestedMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const candidate = parsed as { type?: unknown };
  if (candidate.type !== GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE) {
    return null;
  }

  return { type: GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE };
}
