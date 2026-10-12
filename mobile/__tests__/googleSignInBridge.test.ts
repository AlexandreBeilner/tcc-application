/**
 * @format
 */

import {
  GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE,
  buildGoogleSignInInterceptorScript,
  parseGoogleSignInRequestedMessage,
} from '../googleSignInBridge';

describe('buildGoogleSignInInterceptorScript', () => {
  test('script referencia o tipo de mensagem certo e o listener de clique', () => {
    const script = buildGoogleSignInInterceptorScript();

    expect(script).toContain(JSON.stringify(GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE));
    expect(script).toContain("addEventListener('click'");
    expect(script).toContain('window.ReactNativeWebView.postMessage');
  });

  // O componente <WebView> não é montado neste teste — o script roda como JS
  // "puro" contra um `document`/`window` simulados, sem precisar de emulador
  // (mesma mecânica de downloadBridge.test.ts/sessionBridge.test.ts).
  function run(script: string, fakeWindow: Record<string, unknown>) {
    const listeners: Array<(event: unknown) => void> = [];
    const fakeDocument = {
      addEventListener: (
        _type: string,
        listener: (event: unknown) => void,
      ) => {
        listeners.push(listener);
      },
    };

    // eslint-disable-next-line no-new-func
    const runner = new Function('window', 'document', script);
    runner(fakeWindow, fakeDocument);

    return listeners;
  }

  test('intercepta clique no link "Entrar com Google" (href relativo) e avisa o nativo', () => {
    const postMessage = jest.fn();
    const fakeWindow = {
      __selucraGoogleSignInInterceptorInstalled: false,
      ReactNativeWebView: {postMessage},
      location: {href: 'http://10.0.2.2:5173/login'},
    };

    const listeners = run(buildGoogleSignInInterceptorScript(), fakeWindow);
    expect(listeners).toHaveLength(1);

    const anchor = {getAttribute: () => '/auth/google'};
    const preventDefault = jest.fn();
    const stopImmediatePropagation = jest.fn();
    listeners[0]({
      target: {closest: (selector: string) => (selector === 'a[href]' ? anchor : null)},
      preventDefault,
      stopImmediatePropagation,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopImmediatePropagation).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({type: GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE}),
    );
  });

  test('intercepta o mesmo link mesmo com href absoluto (VITE_GATEWAY_URL configurado)', () => {
    const postMessage = jest.fn();
    const fakeWindow = {
      __selucraGoogleSignInInterceptorInstalled: false,
      ReactNativeWebView: {postMessage},
      location: {href: 'http://10.0.2.2:5173/login'},
    };

    const listeners = run(buildGoogleSignInInterceptorScript(), fakeWindow);
    const anchor = {getAttribute: () => 'http://10.0.2.2:8000/auth/google'};
    const preventDefault = jest.fn();
    listeners[0]({
      target: {closest: (selector: string) => (selector === 'a[href]' ? anchor : null)},
      preventDefault,
      stopImmediatePropagation: jest.fn(),
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test('ignora clique fora de um <a href>', () => {
    const postMessage = jest.fn();
    const fakeWindow = {
      __selucraGoogleSignInInterceptorInstalled: false,
      ReactNativeWebView: {postMessage},
      location: {href: 'http://10.0.2.2:5173/login'},
    };

    const listeners = run(buildGoogleSignInInterceptorScript(), fakeWindow);
    const preventDefault = jest.fn();
    listeners[0]({
      target: {closest: () => null},
      preventDefault,
      stopImmediatePropagation: jest.fn(),
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('ignora link cujo caminho não é /auth/google (ex: outra navegação qualquer)', () => {
    const postMessage = jest.fn();
    const fakeWindow = {
      __selucraGoogleSignInInterceptorInstalled: false,
      ReactNativeWebView: {postMessage},
      location: {href: 'http://10.0.2.2:5173/login'},
    };

    const listeners = run(buildGoogleSignInInterceptorScript(), fakeWindow);
    const anchor = {getAttribute: () => '/licao/3'};
    const preventDefault = jest.fn();
    listeners[0]({
      target: {closest: (selector: string) => (selector === 'a[href]' ? anchor : null)},
      preventDefault,
      stopImmediatePropagation: jest.fn(),
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('ignora href malformado sem lançar', () => {
    const postMessage = jest.fn();
    const fakeWindow = {
      __selucraGoogleSignInInterceptorInstalled: false,
      ReactNativeWebView: {postMessage},
      location: {href: 'http://10.0.2.2:5173/login'},
    };

    const listeners = run(buildGoogleSignInInterceptorScript(), fakeWindow);
    const anchor = {getAttribute: () => null};
    expect(() =>
      listeners[0]({
        target: {closest: (selector: string) => (selector === 'a[href]' ? anchor : null)},
        preventDefault: jest.fn(),
        stopImmediatePropagation: jest.fn(),
      }),
    ).not.toThrow();
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('parseGoogleSignInRequestedMessage', () => {
  test('aceita mensagem válida', () => {
    const message = parseGoogleSignInRequestedMessage(
      JSON.stringify({type: GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE}),
    );

    expect(message).toEqual({type: GOOGLE_SIGNIN_REQUESTED_MESSAGE_TYPE});
  });

  test('rejeita JSON malformado sem lançar', () => {
    expect(parseGoogleSignInRequestedMessage('não é json')).toBeNull();
  });

  test('rejeita mensagem de outro tipo/origem', () => {
    expect(
      parseGoogleSignInRequestedMessage(JSON.stringify({type: 'outra-coisa'})),
    ).toBeNull();
    expect(parseGoogleSignInRequestedMessage(JSON.stringify('string solta'))).toBeNull();
    expect(parseGoogleSignInRequestedMessage(JSON.stringify(42))).toBeNull();
  });
});
