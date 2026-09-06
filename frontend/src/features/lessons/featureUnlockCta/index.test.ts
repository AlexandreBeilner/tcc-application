import { describe, expect, it } from 'vitest'
import { featureUnlockCtaFor } from '.'

describe('featureUnlockCtaFor', () => {
    it('portfolio → CTA pro Portfólio (rota "/")', () => {
        expect(featureUnlockCtaFor(['portfolio'])).toEqual({ label: 'Ir pro Portfólio', path: '/' })
    })

    it('calculator → CTA pra Calculadora', () => {
        expect(featureUnlockCtaFor(['calculator'])).toEqual({ label: 'Ir pra Calculadora', path: '/calculadora' })
    })

    it('news_feed → CTA pro painel de notícias (tarefa 7.1.3)', () => {
        expect(featureUnlockCtaFor(['news_feed'])).toEqual({ label: 'Ver Notícias', path: '/noticias' })
    })

    it('chave de produto (asset:*) não tem CTA de feature', () => {
        expect(featureUnlockCtaFor(['asset:tesouro_selic'])).toBeNull()
    })

    it('sem unlocksKeys → null', () => {
        expect(featureUnlockCtaFor([])).toBeNull()
    })
})
