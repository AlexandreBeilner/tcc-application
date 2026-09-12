// A entrada "typings" de react-native-webview@14.0.1 (index.d.ts da raiz do
// pacote) aponta pra um tipo legado: uma classe genérica
// `WebView<P = undefined> extends Component<WebViewProps & P>`, de antes do
// componente virar forwardRef. Assim que qualquer `ref` é passado, a
// inferência de `P` colapsa a interseção `WebViewProps & P` pra `never` e
// todas as props somem. A alternativa dentro do próprio pacote
// (lib/WebView.{android,ios}.d.ts, o componente forwardRef real) tipa o ref
// como `RefAttributes<unknown>` — sem os métodos imperativos (goBack etc.),
// então também não dá pra usar como está.
//
// Este arquivo substitui os tipos do módulo (via "paths" no tsconfig.json)
// pelo shape real do componente em runtime: props das três plataformas e um
// ref com só os métodos que este app chama. Nada aqui muda o bundle — Metro
// continua resolvendo o pacote real via node_modules/react-native-webview,
// isso é só a lente de type-checking do tsc.
declare module 'react-native-webview' {
    import type { ForwardRefExoticComponent, RefAttributes } from 'react';
    import type {
        AndroidWebViewProps,
        IOSWebViewProps,
        ShouldStartLoadRequest,
        WebViewMessageEvent,
        WebViewNavigation,
        WindowsWebViewProps,
    } from 'react-native-webview/lib/WebViewTypes';

    export type WebViewProps = IOSWebViewProps &
        AndroidWebViewProps &
        WindowsWebViewProps;

    export interface WebViewHandle {
        goBack: () => void;
        goForward: () => void;
        reload: () => void;
        stopLoading: () => void;
        injectJavaScript: (script: string) => void;
    }

    export const WebView: ForwardRefExoticComponent<
        WebViewProps & RefAttributes<WebViewHandle>
    >;
    export default WebView;

    export type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewNavigation };
}
