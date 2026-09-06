import type { FeatureUnlockCta } from './types'

export type { FeatureUnlockCta } from './types'

// CTA do passo Desbloqueio (tela 3.2) pra lição cujo `unlocksKeys` libera uma
// *feature* (não um produto real, que usa `unlocksAssetTicker`/"Comprar
// agora" — ver `pages/Lesson/index.tsx`). Mesmo mecanismo generalizado pra
// rota fixa em vez de ticker (tarefa 7.1.1, 0.1/0.2: "Ir pro Portfólio"/"Ir
// pra Calculadora"). Só as chaves com destino próprio de navegação entram
// aqui — `news_feed` fica de fora até a 7.1.3 (2.4) precisar dela.
const FEATURE_UNLOCK_ROUTES: Record<string, FeatureUnlockCta> = {
    portfolio: { label: 'Ir pro Portfólio', path: '/' },
    calculator: { label: 'Ir pra Calculadora', path: '/calculadora' },
}

export function featureUnlockCtaFor(unlocksKeys: string[]): FeatureUnlockCta | null {
    for (const key of unlocksKeys) {
        const cta = FEATURE_UNLOCK_ROUTES[key]
        if (cta) return cta
    }
    return null
}
