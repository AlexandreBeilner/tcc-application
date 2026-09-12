/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import escapeStringRegexp from 'escape-string-regexp';
import { View } from 'react-native';
import Keychain from 'react-native-keychain';
import App, {
  AUTH_KEYCHAIN_SERVICE,
  isWithinAppOrigin,
  ORIGIN_WHITELIST,
} from '../App';
import { AUTH_TOKEN_CHANGED_MESSAGE_TYPE } from '../sessionBridge';

// __mocks__/react-native-keychain.js expõe jest.fn() — reset entre testes
// pra não vazar mockResolvedValueOnce/chamadas de um teste pro outro.
beforeEach(() => {
  jest.clearAllMocks();
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
    expect(webview.props.injectedJavaScriptBeforeContentLoaded).toBe('');
  });

  test('restaura token salvo no Keychain e reinjeta no primeiro carregamento', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
      username: 'investimenta',
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
      'investimenta',
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
