/**
 * @format
 */

import {
  FILE_DOWNLOAD_MESSAGE_TYPE,
  buildDownloadInterceptorScript,
  parseFileDownloadMessage,
} from '../downloadBridge';

describe('buildDownloadInterceptorScript', () => {
  test('script referencia o tipo de mensagem certo e o listener de clique', () => {
    const script = buildDownloadInterceptorScript();

    expect(script).toContain(JSON.stringify(FILE_DOWNLOAD_MESSAGE_TYPE));
    expect(script).toContain("addEventListener('click'");
    expect(script).toContain('window.ReactNativeWebView.postMessage');
  });

  // O componente <WebView> não é montado neste teste — o script roda como
  // JS "puro" contra um `document`/`fetch`/`FileReader` simulados, sem
  // precisar de emulador (mesma mecânica de sessionBridge.test.ts).
  test('intercepta clique em <a download> com href blob: e manda base64 pro nativo', async () => {
    const postMessage = jest.fn();
    const fakeWindow: Record<string, unknown> = {
      __selucraDownloadInterceptorInstalled: false,
      ReactNativeWebView: { postMessage },
    };

    const listeners: Array<(event: unknown) => void> = [];
    const fakeDocument = {
      addEventListener: (
        _type: string,
        listener: (event: unknown) => void,
      ) => {
        listeners.push(listener);
      },
    };

    const fakeBlob = { type: 'application/json' };
    const fakeResponse = { blob: () => Promise.resolve(fakeBlob) };
    const fetchMock = jest.fn().mockResolvedValue(fakeResponse);

    class FakeFileReader {
      onloadend: (() => void) | null = null;
      result: string | null = null;
      readAsDataURL(_blob: unknown) {
        this.result = 'data:application/json;base64,eyJhIjoxfQ==';
        this.onloadend?.();
      }
    }

    // eslint-disable-next-line no-new-func
    const run = new Function(
      'window',
      'document',
      'fetch',
      'FileReader',
      `${buildDownloadInterceptorScript()}`,
    );
    run(fakeWindow, fakeDocument, fetchMock, FakeFileReader);

    expect(listeners).toHaveLength(1);

    const anchor = {
      getAttribute: (name: string) =>
        name === 'download' ? 'meus-dados.json' : 'blob:http://app/xyz',
    };
    const preventDefault = jest.fn();
    const stopImmediatePropagation = jest.fn();
    const event = {
      target: { closest: (selector: string) => (selector === 'a[download]' ? anchor : null) },
      preventDefault,
      stopImmediatePropagation,
    };

    listeners[0](event);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopImmediatePropagation).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('blob:http://app/xyz');

    // fetch().then(response => response.blob()).then(blob => ...) — cada
    // `.then` que devolve uma promise encadeada consome mais de um microtask
    // tick pra "adotar" o estado dela; alguns ticks de sobra aqui não fazem
    // mal (a asserção seguinte falha de qualquer forma se o postMessage não
    // tiver disparado ainda).
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      type: FILE_DOWNLOAD_MESSAGE_TYPE,
      filename: 'meus-dados.json',
      mimeType: 'application/json',
      base64: 'eyJhIjoxfQ==',
    });
  });

  test('ignora clique fora de um <a download>', () => {
    const postMessage = jest.fn();
    const fakeWindow: Record<string, unknown> = {
      __selucraDownloadInterceptorInstalled: false,
      ReactNativeWebView: { postMessage },
    };
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
    const run = new Function(
      'window',
      'document',
      'fetch',
      'FileReader',
      `${buildDownloadInterceptorScript()}`,
    );
    run(fakeWindow, fakeDocument, jest.fn(), class {});

    const preventDefault = jest.fn();
    listeners[0]({
      target: { closest: () => null },
      preventDefault,
      stopImmediatePropagation: jest.fn(),
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('ignora <a download> cujo href não é blob:', () => {
    const postMessage = jest.fn();
    const fakeWindow: Record<string, unknown> = {
      __selucraDownloadInterceptorInstalled: false,
      ReactNativeWebView: { postMessage },
    };
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
    const run = new Function(
      'window',
      'document',
      'fetch',
      'FileReader',
      `${buildDownloadInterceptorScript()}`,
    );
    run(fakeWindow, fakeDocument, jest.fn(), class {});

    const anchor = {
      getAttribute: (name: string) =>
        name === 'download' ? 'arquivo.pdf' : 'https://example.com/arquivo.pdf',
    };
    const preventDefault = jest.fn();
    listeners[0]({
      target: { closest: () => anchor },
      preventDefault,
      stopImmediatePropagation: jest.fn(),
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('parseFileDownloadMessage', () => {
  test('aceita mensagem válida', () => {
    const message = parseFileDownloadMessage(
      JSON.stringify({
        type: FILE_DOWNLOAD_MESSAGE_TYPE,
        filename: 'meus-dados.json',
        mimeType: 'application/json',
        base64: 'eyJhIjoxfQ==',
      }),
    );

    expect(message).toEqual({
      type: FILE_DOWNLOAD_MESSAGE_TYPE,
      filename: 'meus-dados.json',
      mimeType: 'application/json',
      base64: 'eyJhIjoxfQ==',
    });
  });

  test('rejeita JSON malformado sem lançar', () => {
    expect(parseFileDownloadMessage('não é json')).toBeNull();
  });

  test('rejeita mensagem de outro tipo/origem', () => {
    expect(
      parseFileDownloadMessage(JSON.stringify({ type: 'outra-coisa' })),
    ).toBeNull();
    expect(parseFileDownloadMessage(JSON.stringify('string solta'))).toBeNull();
    expect(parseFileDownloadMessage(JSON.stringify(42))).toBeNull();
  });

  test('rejeita campos de tipo inesperado ou ausentes', () => {
    expect(
      parseFileDownloadMessage(
        JSON.stringify({
          type: FILE_DOWNLOAD_MESSAGE_TYPE,
          filename: 123,
          mimeType: 'application/json',
          base64: 'abc',
        }),
      ),
    ).toBeNull();
    expect(
      parseFileDownloadMessage(
        JSON.stringify({ type: FILE_DOWNLOAD_MESSAGE_TYPE, filename: 'x.json' }),
      ),
    ).toBeNull();
  });
});
