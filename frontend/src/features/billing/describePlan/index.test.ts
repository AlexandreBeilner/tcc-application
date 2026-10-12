import { describe, expect, it } from 'vitest'
import type { BillingStatus } from '../../../services/billing'
import { APP_STORE_SUBSCRIPTIONS_URL, describePlan, PLAY_STORE_SUBSCRIPTIONS_URL } from '.'

const ACTIVE: BillingStatus = {
    isPro: true,
    state: 'active',
    plan: 'monthly',
    store: 'stripe',
    expiresAt: '2027-03-15T12:00:00.000Z',
    willRenew: true,
    managementUrl: 'https://portal.example/p',
    billingEnabled: true,
}

describe('describePlan (MO.3.3)', () => {
    it('web: leva ao portal informado pelo provedor', () => {
        const d = describePlan(ACTIVE, false)
        expect(d.action).toEqual({ label: 'Gerenciar assinatura', href: 'https://portal.example/p', external: true })
        expect(d.detail).toContain('Renova em')
    })

    it('web dentro do app: sem link de pagamento, só instrução', () => {
        const d = describePlan(ACTIVE, true)
        expect(d.action).toBeNull()
        expect(d.instruction).toMatch(/navegador/)
    })

    it('App Store e Play Store usam o link da loja quando o provedor não manda um', () => {
        expect(describePlan({ ...ACTIVE, store: 'app_store', managementUrl: null }, false).action?.href).toBe(APP_STORE_SUBSCRIPTIONS_URL)
        expect(describePlan({ ...ACTIVE, store: 'play_store', managementUrl: null }, true).action?.href).toBe(PLAY_STORE_SUBSCRIPTIONS_URL)
    })

    it('cancelada mas ainda ativa mostra "PRO até"', () => {
        const d = describePlan({ ...ACTIVE, willRenew: false }, false)
        expect(d.detail).toMatch(/PRO até \d{2}\/\d{2}\/\d{4}/)
    })

    it('concessão promocional não tem destino e explica', () => {
        const d = describePlan(
            { ...ACTIVE, store: 'promotional', plan: 'unknown', expiresAt: null, willRenew: false, managementUrl: null },
            false,
        )
        expect(d.action).toBeNull()
        expect(d.instruction).toMatch(/concedido pela equipe/)
        expect(d.detail).toContain('Sem data de término')
    })

    it('expirado reafirma que nada foi apagado e oferece voltar', () => {
        const d = describePlan({ ...ACTIVE, isPro: false, state: 'expired' }, false)
        expect(d.detail).toMatch(/Nada do que você conquistou foi apagado/)
        expect(d.action?.href).toBe('/planos')
    })

    it('problema de cobrança leva ao destino da loja', () => {
        const d = describePlan({ ...ACTIVE, state: 'billing_issue', store: 'play_store', managementUrl: null }, false)
        expect(d.headline).toMatch(/problema no pagamento/)
        expect(d.action?.href).toBe(PLAY_STORE_SUBSCRIPTIONS_URL)
    })

    it('nunca assinou: plano grátis com convite', () => {
        const d = describePlan({ ...ACTIVE, isPro: false, state: 'none', plan: null, store: null }, false)
        expect(d.headline).toBe('Plano grátis')
        expect(d.action?.href).toBe('/planos')
    })

    describe('assinou em outra plataforma (MO.4.3)', () => {
        it('web, visto no app: avisa que já vale e não oferece link de pagamento', () => {
            const d = describePlan(ACTIVE, true, 'android')
            expect(d.instruction).toMatch(/pela web.*já vale aqui no app, não é preciso assinar de novo/)
            expect(d.action).toBeNull()
        })

        it('App Store vista no Android: avisa, e o destino de gerenciar continua a página da loja certa', () => {
            const d = describePlan({ ...ACTIVE, store: 'app_store', managementUrl: null }, true, 'android')
            expect(d.instruction).toMatch(/pela App Store.*não é preciso assinar de novo/)
            expect(d.action?.href).toBe(APP_STORE_SUBSCRIPTIONS_URL)
        })

        it('Google Play visto no iOS: avisa', () => {
            const d = describePlan({ ...ACTIVE, store: 'play_store', managementUrl: null }, true, 'ios')
            expect(d.instruction).toMatch(/pelo Google Play.*não é preciso assinar de novo/)
        })

        it('assinou na loja deste mesmo aparelho: sem aviso', () => {
            expect(describePlan({ ...ACTIVE, store: 'play_store', managementUrl: null }, true, 'android').instruction).toBeNull()
            expect(describePlan({ ...ACTIVE, store: 'app_store', managementUrl: null }, true, 'ios').instruction).toBeNull()
        })

        it('no navegador ou sem plataforma conhecida não avisa', () => {
            expect(describePlan({ ...ACTIVE, store: 'play_store' }, false, 'android').instruction).toBeNull()
            expect(describePlan({ ...ACTIVE, store: 'play_store' }, true, null).instruction).toBeNull()
        })

        it('plano expirado não leva aviso de "já vale"', () => {
            expect(describePlan({ ...ACTIVE, isPro: false, state: 'expired', store: 'app_store' }, true, 'android').instruction).toBeNull()
        })
    })
})
