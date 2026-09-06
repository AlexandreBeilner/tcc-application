import { describe, expect, it } from 'vitest'
import { featureUnlockCtaFor } from '.'

describe('featureUnlockCtaFor', () => {
    it('portfolio → CTA pro Portfólio (rota "/")', () => {
        expect(featureUnlockCtaFor(['portfolio'])).toEqual({ label: 'Ir pro Portfólio', path: '/' })
    })

    it('calculator → CTA pra Calculadora', () => {
        expect(featureUnlockCtaFor(['calculator'])).toEqual({ label: 'Ir pra Calculadora', path: '/calculadora' })
    })

    it('chave de produto (asset:*) não tem CTA de feature', () => {
        expect(featureUnlockCtaFor(['asset:tesouro_selic'])).toBeNull()
    })

    it('sem unlocksKeys → null', () => {
        expect(featureUnlockCtaFor([])).toBeNull()
    })
})
