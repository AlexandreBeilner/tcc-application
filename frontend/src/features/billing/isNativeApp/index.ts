// Dentro do app (WebView do React Native) o SDK injeta `window.ReactNativeWebView`. Nesse caso a
// compra nunca é web (regra das lojas): vai pela ponte para a compra nativa (`nativePurchases`).
export function isNativeApp(): boolean {
    return typeof window !== 'undefined' && 'ReactNativeWebView' in window
}

export type NativePlatform = 'android' | 'ios'

// Plataforma do app, injetada por ele antes do SPA montar (`mobile/purchasesBridge.ts`). `null`
// no navegador ou num app antigo que não injeta.
export function nativePlatform(): NativePlatform | null {
    if (typeof window === 'undefined') return null
    const info = (window as unknown as { __investimentaNative?: { platform?: unknown } }).__investimentaNative
    return info?.platform === 'android' || info?.platform === 'ios' ? info.platform : null
}
