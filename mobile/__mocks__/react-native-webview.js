// Mock manual pro Jest — o módulo nativo real (TurboModule) não existe fora
// de um app rodando de verdade num dispositivo/emulador, então testes de
// unidade/smoke precisam de um stub. Mesma mecânica de
// __mocks__/react-native-config.js: arquivo em __mocks__/<pacote>.js na raiz
// é aplicado automaticamente pro pacote de node_modules correspondente.
//
// forwardRef (não só `WebView = View`) a partir da tarefa 3.3: o fluxo de
// login Google nativo chama `webviewRef.current.injectJavaScript(...)` pra
// aplicar o token na sessão já em execução — sem esse método imperativo no
// mock, `webviewRef.current` seria a instância crua da `View` (sem
// `injectJavaScript`) e o teste quebraria com "not a function". `View` ainda
// é o elemento renderizado por baixo (`React.createElement(View, props)`),
// então `findAllByType(View)`/inspeção de props continuam funcionando
// exatamente como antes desta mudança.
import React from 'react';
import { View } from 'react-native';

export const injectJavaScript = jest.fn();
export const reload = jest.fn();
export const goBack = jest.fn();
export const goForward = jest.fn();
export const stopLoading = jest.fn();

export const WebView = React.forwardRef(function WebView(props, ref) {
  React.useImperativeHandle(ref, () => ({
    goBack,
    goForward,
    reload,
    stopLoading,
    injectJavaScript,
  }));
  return React.createElement(View, props);
});

export default WebView;
