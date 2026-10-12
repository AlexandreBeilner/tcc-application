/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import escapeStringRegexp from 'escape-string-regexp';
import { Alert, View } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Keychain from 'react-native-keychain';
import Share from 'react-native-share';
import * as WebviewModule from 'react-native-webview';
import App, {
  AUTH_KEYCHAIN_SERVICE,
  isWithinAppOrigin,
  ORIGIN_WHITELIST,
} from '../App';
import { AUTH_TOKEN_CHANGED_MESSAGE_TYPE } from '../sessionBridge';
import { FILE_DOWNLOAD_MESSAGE_TYPE } from '../downloadBridge';
import { GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE } from '../googleSignInBridge';
import {
  PURCHASES_REQUEST_MESSAGE_TYPE,
  PURCHASES_RESPONSE_EVENT,
} from '../purchasesBridge';

// __mocks__/react-native-webview.js exporta `injectJavaScript` como um
// jest.fn() de módulo, mas o augmentation de tipos em
// types/react-native-webview.d.ts (tarefa 1.3) descreve só o shape REAL do
// pacote em runtime (sem esse export solto, que só existe no mock) — importar
// nomeado direto quebraria o type-check. `import *` (mesmo mecanismo de
// resolução de módulo que App.tsx usa pra `WebView`, então garantidamente a
// MESMA instância de jest.fn() por trás — `jest.requireMock` chegou a ser
// tentado aqui e falhou por criar uma segunda instância de mock isolada) com
// um cast só pra driblar o tipo.
const webviewMock = WebviewModule as unknown as {
  injectJavaScript: jest.Mock;
};

// __mocks__/react-native-keychain.js expõe jest.fn() — reset entre testes
// pra não vazar mockResolvedValueOnce/chamadas de um teste pro outro.
beforeEach(() => {
  jest.clearAllMocks();
  // `fetch` não existe no ambiente de teste do preset RN (só em runtime real,
  // via polyfill do próprio React Native) — sem esse stub, o POST
  // /auth/google/token de App.tsx (tarefa 3.3) lançaria ReferenceError.
  // `globalThis` (não `global`, que exigiria @types/node — não instalado
  // neste projeto) é o global padrão da linguagem, já coberto pelos tipos.
  (globalThis as unknown as {fetch: typeof fetch}).fetch = jest.fn();
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

// O <WebView> real é mockado como <View> (__mocks__/react-native-webview.js)
// — as props (originWhitelist, injectedJavaScriptBeforeContentLoaded,
// onMessage etc.) continuam acessíveis no test instance mesmo sem
// comportamento nativo por trás, e é o suficiente pra testar a ponte de
// sessão (tarefa 2.1) sem emulador.
function getWebViewInstance(
  root: ReactTestRenderer.ReactTestInstance,
): ReactTestRenderer.ReactTestInstance {
  const [instance] = root
    .findAllByType(View)
    .filter(candidate => 'originWhitelist' in candidate.props);
  if (!instance) {
    throw new Error('WebView não encontrado na árvore renderizada');
  }
  return instance;
}

// Callback assíncrono (não só `() => create(...)`) é o que faz `act` esperar
// a cadeia `Keychain.getGenericPassword().then().finally()` disparada pelo
// useEffect de restauração de sessão (App.tsx) resolver antes de devolver o
// controle pro teste — com o callback síncrono, a leitura assíncrona do
// Keychain corre por fora do act e dispara o aviso "not wrapped in act(...)"
// do React, além de deixar isSessionReady/authToken desatualizados na hora
// da asserção.
async function renderApp(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(<App />);
  });
  return root;
}

describe('ponte de sessão (Keychain)', () => {
  test('sem sessão salva, não reinjeta nada no primeiro carregamento', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);

    const root = await renderApp();

    expect(Keychain.getGenericPassword).toHaveBeenCalledWith({
      service: AUTH_KEYCHAIN_SERVICE,
    });
    const webview = getWebViewInstance(root.root);
    // Só o script de plataforma (MO.4.2): nada de reinjeção de token.
    const script = webview.props.injectedJavaScriptBeforeContentLoaded;
    expect(script).toContain('__selucraNative');
    expect(script).not.toContain('localStorage');
  });

  test('restaura token salvo no Keychain e reinjeta no primeiro carregamento', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
      username: 'selucra',
      password: 'saved-jwt',
      service: AUTH_KEYCHAIN_SERVICE,
      storage: 'keychain',
    });

    const root = await renderApp();

    const webview = getWebViewInstance(root.root);
    expect(
      webview.props.injectedJavaScriptBeforeContentLoaded,
    ).toContain(JSON.stringify('saved-jwt'));
  });

  test('mensagem com token novo grava no Keychain', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);

    const root = await renderApp();

    const webview = getWebViewInstance(root.root);
    await ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
            token: 'new-jwt',
          }),
        },
      });
    });

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'selucra',
      'new-jwt',
      { service: AUTH_KEYCHAIN_SERVICE },
    );
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  });

  test('mensagem de logout (token null) limpa o Keychain', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);

    const root = await renderApp();

    const webview = getWebViewInstance(root.root);
    await ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
            token: null,
          }),
        },
      });
    });

    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: AUTH_KEYCHAIN_SERVICE,
    });
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });
});

describe('ponte de download (Share)', () => {
  test('mensagem de download abre o Share nativo com a data URI e o filename sem extensão', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);

    const root = await renderApp();

    const webview = getWebViewInstance(root.root);
    await ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: FILE_DOWNLOAD_MESSAGE_TYPE,
            filename: 'meus-dados.json',
            mimeType: 'application/json',
            base64: 'eyJhIjoxfQ==',
          }),
        },
      });
    });

    expect(Share.open).toHaveBeenCalledWith({
      url: 'data:application/json;base64,eyJhIjoxfQ==',
      filename: 'meus-dados',
      type: 'application/json',
      useInternalStorage: true,
      failOnCancel: false,
    });
    // Mensagem de download não é uma mudança de token — não pode mexer no
    // Keychain (só a ponte de sessão, tarefa 2.1, faz isso).
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  });

  test('cancelamento/erro do share sheet não derruba o app', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (Share.open as jest.Mock).mockRejectedValueOnce(new Error('User did not share'));

    const root = await renderApp();
    const webview = getWebViewInstance(root.root);

    await ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: FILE_DOWNLOAD_MESSAGE_TYPE,
            filename: 'meus-dados.json',
            mimeType: 'application/json',
            base64: 'eyJhIjoxfQ==',
          }),
        },
      });
      // Deixa a promise rejeitada do Share.open resolver dentro do act.
      await Promise.resolve();
    });

    expect(Share.open).toHaveBeenCalled();
  });
});

describe('login Google nativo (SDK, tarefa 3.3)', () => {
  function sendGoogleSignInRequestedMessage(
    webview: ReactTestRenderer.ReactTestInstance,
  ) {
    return ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({type: GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE}),
        },
      });
      // Deixa a cadeia hasPlayServices -> signIn -> fetch -> json() ->
      // keychain -> injectJavaScript resolver dentro do act antes de
      // qualquer asserção — vários `await` em sequência, cada um consome
      // mais de um microtask tick (mesma observação de
      // downloadBridge.test.ts), por isso a folga generosa aqui.
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
  }

  test('sucesso: troca o idToken por JWT, grava no Keychain e reinjeta+recarrega a sessão', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {idToken: 'native-id-token', user: {email: 'user@example.com'}},
    });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({token: 'jwt-abc', user: {email: 'user@example.com'}}),
    });

    const root = await renderApp();
    const webview = getWebViewInstance(root.root);
    await sendGoogleSignInRequestedMessage(webview);

    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:8000/auth/google/token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({idToken: 'native-id-token'}),
      }),
    );
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'selucra',
      'jwt-abc',
      {service: AUTH_KEYCHAIN_SERVICE},
    );
    expect(webviewMock.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify('jwt-abc')),
    );
    expect(webviewMock.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('window.location.reload()'),
    );
  });

  test('cancelamento no seletor de conta do Google não chama o backend nem mexe no Keychain', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'cancelled',
      data: null,
    });

    const root = await renderApp();
    const webview = getWebViewInstance(root.root);
    await sendGoogleSignInRequestedMessage(webview);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  test('idToken rejeitado pelo backend mostra alerta nativo, sem derrubar o app', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {idToken: 'expired-id-token', user: {email: 'user@example.com'}},
    });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ok: false, status: 401});

    const root = await renderApp();
    const webview = getWebViewInstance(root.root);
    await sendGoogleSignInRequestedMessage(webview);

    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Não foi possível entrar com o Google',
      expect.any(String),
    );

    alertSpy.mockRestore();
  });
});

describe('ponte de compra nativa (MO.4.2)', () => {
  test('pedido de planos volta ao SPA como evento, com os planos da camada de compras', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    const root = await renderApp();
    const webview = getWebViewInstance(root.root);

    await ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: PURCHASES_REQUEST_MESSAGE_TYPE,
            requestId: 'abc',
            op: 'plans',
          }),
        },
      });
    });

    expect(webviewMock.injectJavaScript).toHaveBeenCalledTimes(1);
    const script = webviewMock.injectJavaScript.mock.calls[0][0] as string;
    expect(script).toContain(PURCHASES_RESPONSE_EVENT);
    expect(script).toContain('abc');
    expect(script).toContain('(teste)');
  });

  test('pedido malformado é ignorado, sem resposta', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    const root = await renderApp();
    const webview = getWebViewInstance(root.root);

    await ReactTestRenderer.act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: PURCHASES_REQUEST_MESSAGE_TYPE, op: 'plans' }),
        },
      });
    });

    expect(webviewMock.injectJavaScript).not.toHaveBeenCalled();
  });
});

describe('isWithinAppOrigin', () => {
  // APP_WEB_URL mockado em __mocks__/react-native-config.js.
  const APP_WEB_URL = 'http://10.0.2.2:5173';

  test('aceita a própria origem, com ou sem caminho', () => {
    expect(isWithinAppOrigin(APP_WEB_URL)).toBe(true);
    expect(isWithinAppOrigin(`${APP_WEB_URL}/licao/3`)).toBe(true);
  });

  test('rejeita origem diferente', () => {
    expect(isWithinAppOrigin('http://evil.com')).toBe(false);
  });

  // Regressão: "startsWith" aceitava qualquer host que tivesse a origem
  // legítima como prefixo literal — ex. um host malicioso com o domínio
  // certo "colado" na frente, sem separador nenhum entre os dois.
  test('rejeita host cujo prefixo bate mas a origem é outra', () => {
    expect(isWithinAppOrigin(`${APP_WEB_URL}0.evil.com`)).toBe(false);
    expect(isWithinAppOrigin('http://10.0.2.2:5173.evil.com')).toBe(false);
  });

  test('rejeita URL malformada sem lançar', () => {
    expect(isWithinAppOrigin('não é uma url')).toBe(false);
  });
});

// Regressão: react-native-webview não aceita uma regex pronta em
// originWhitelist — ele mesmo escapa a entrada inteira (escape-string-regexp)
// e só depois expande "*" literal pra ".*" (WebViewShared.tsx,
// originWhitelistToRegex). Uma entrada pré-escapada por nós sofria duplo
// escape e não batia nem com a própria origem, derrubando toda navegação
// top-level pro browser externo. Este teste replica exatamente o algoritmo
// da lib pra travar a regressão sem precisar de emulador.
describe('ORIGIN_WHITELIST', () => {
  function compileLikeReactNativeWebview(entry: string): RegExp {
    return new RegExp(`^${escapeStringRegexp(entry).replace(/\\\*/g, '.*')}`);
  }

  test('a entrada compilada bate com a própria origem e rejeita outras', () => {
    const compiled = compileLikeReactNativeWebview(ORIGIN_WHITELIST[0]);

    expect(compiled.test('http://10.0.2.2:5173')).toBe(true);
    expect(compiled.test('http://evil.com')).toBe(false);
  });
});
