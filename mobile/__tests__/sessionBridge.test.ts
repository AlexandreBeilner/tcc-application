/**
 * @format
 */

import {
  AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
  AUTH_TOKEN_STORAGE_KEY,
  buildAuthTokenReinjectionScript,
  buildAuthWatcherScript,
  parseAuthTokenChangedMessage,
} from '../sessionBridge';

describe('buildAuthWatcherScript', () => {
  test('script referencia a chave de localStorage e o tipo de mensagem certos', () => {
    const script = buildAuthWatcherScript();

    expect(script).toContain(JSON.stringify(AUTH_TOKEN_STORAGE_KEY));
    expect(script).toContain(JSON.stringify(AUTH_TOKEN_CHANGED_MESSAGE_TYPE));
    expect(script).toContain('window.ReactNativeWebView.postMessage');
  });

  // O componente <WebView> não é montado neste teste — este é um teste de
  // unidade do próprio script, executado como JS "puro" (sem localStorage
  // real) pra travar a lógica de detecção de mudança sem precisar de
  // emulador. localStorage/window/setInterval são simulados manualmente.
  test('avisa a sessão já existente e depois só quando o valor da chave muda', () => {
    jest.useFakeTimers();

    const store: Record<string, string | null> = {
      [AUTH_TOKEN_STORAGE_KEY]: 'token-inicial',
    };
    const postMessage = jest.fn();
    const fakeWindow = {
      __investimentaAuthWatcherInstalled: false,
      ReactNativeWebView: { postMessage },
    };
    const fakeLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
    };

    // eslint-disable-next-line no-new-func
    const run = new Function(
      'window',
      'localStorage',
      'setInterval',
      `${buildAuthWatcherScript()}`,
    );
    run(fakeWindow, fakeLocalStorage, setInterval);

    // Sessão que já existia ao carregar: avisada uma vez, na hora (MO.4.1).
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
      token: 'token-inicial',
    });

    jest.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(1);

    store[AUTH_TOKEN_STORAGE_KEY] = 'token-novo';
    jest.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(JSON.parse(postMessage.mock.calls[1][0])).toEqual({
      type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
      token: 'token-novo',
    });

    store[AUTH_TOKEN_STORAGE_KEY] = null;
    jest.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(JSON.parse(postMessage.mock.calls[2][0])).toEqual({
      type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
      token: null,
    });

    jest.useRealTimers();
  });
});

describe('AUTH_TOKEN_STORAGE_KEY', () => {
  // Trava a chave igual à "current" de frontend/src/utils/storage/index.ts: a RC.1.4 renomeou a do
  // SPA e a ponte ficou cega ao login (achado na MO.4.1).
  test('é a chave atual do SPA', () => {
    expect(AUTH_TOKEN_STORAGE_KEY).toBe('app.auth.token');
  });
});

describe('buildAuthTokenReinjectionScript', () => {
  test('token null produz script vazio (nada a reinjetar)', () => {
    expect(buildAuthTokenReinjectionScript(null)).toBe('');
  });

  test('token presente produz script que grava a chave certa no localStorage', () => {
    const script = buildAuthTokenReinjectionScript('jwt-abc');

    expect(script).toContain(JSON.stringify(AUTH_TOKEN_STORAGE_KEY));
    expect(script).toContain(JSON.stringify('jwt-abc'));
    expect(script).toContain('localStorage.setItem');
  });
});

describe('parseAuthTokenChangedMessage', () => {
  test('aceita mensagem válida com token string', () => {
    const message = parseAuthTokenChangedMessage(
      JSON.stringify({ type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE, token: 'jwt' }),
    );

    expect(message).toEqual({
      type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
      token: 'jwt',
    });
  });

  test('aceita mensagem válida com token null (logout)', () => {
    const message = parseAuthTokenChangedMessage(
      JSON.stringify({ type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE, token: null }),
    );

    expect(message).toEqual({
      type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE,
      token: null,
    });
  });

  test('rejeita JSON malformado sem lançar', () => {
    expect(parseAuthTokenChangedMessage('não é json')).toBeNull();
  });

  test('rejeita mensagem de outro tipo/origem', () => {
    expect(
      parseAuthTokenChangedMessage(JSON.stringify({ type: 'outra-coisa' })),
    ).toBeNull();
    expect(
      parseAuthTokenChangedMessage(JSON.stringify('string solta')),
    ).toBeNull();
    expect(parseAuthTokenChangedMessage(JSON.stringify(42))).toBeNull();
  });

  test('rejeita token de tipo inesperado', () => {
    expect(
      parseAuthTokenChangedMessage(
        JSON.stringify({ type: AUTH_TOKEN_CHANGED_MESSAGE_TYPE, token: 123 }),
      ),
    ).toBeNull();
  });
});
