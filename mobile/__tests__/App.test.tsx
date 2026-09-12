/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import escapeStringRegexp from 'escape-string-regexp';
import App, { isWithinAppOrigin, ORIGIN_WHITELIST } from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
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
