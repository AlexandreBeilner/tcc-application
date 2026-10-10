// Dentro do app (WebView do React Native) o SDK injeta `window.ReactNativeWebView`. Nesse caso a
// tela nunca oferece pagamento web (regra das lojas); a compra nativa entra na MO.4.2.
export function isNativeApp(): boolean {
    return typeof window !== 'undefined' && 'ReactNativeWebView' in window
}
