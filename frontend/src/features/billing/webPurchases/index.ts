import type { Package, Purchases } from '@revenuecat/purchases-js'
import type { PurchaseOutcome, WebPlan, WebPurchases } from './types'

export type { PurchaseOutcome, WebPlan, WebPurchases } from './types'

// Chave PÚBLICA do projeto web no RevenueCat. Sem ela a compra fica indisponível (a tela mostra o
// plano mas não oferece o botão).
export const WEB_PUBLIC_KEY: string | undefined = import.meta.env.VITE_REVENUECAT_WEB_PUBLIC_KEY || undefined

// Identificadores predefinidos do RevenueCat (`PackageType`), sem importar o SDK no pacote principal.
const PACKAGE_TYPE_PLAN: Record<string, WebPlan['id']> = { $rc_monthly: 'monthly', $rc_annual: 'annual' }

function toPlan(pkg: Package): WebPlan | null {
    const id = PACKAGE_TYPE_PLAN[pkg.packageType] ?? null
    if (!id) return null
    const { price } = pkg.product
    return { id, formattedPrice: price.formattedPrice, amountMicros: price.amountMicros, currency: price.currency, handle: pkg }
}

// Desconto do anual sobre 12 mensalidades, calculado dos preços reais (nunca texto fixo).
// `null` se o anual não for mais barato.
export function annualDiscountPercent(monthly: WebPlan, annual: WebPlan): number | null {
    const full = monthly.amountMicros * 12
    if (full <= 0 || annual.amountMicros >= full) return null
    return Math.round((1 - annual.amountMicros / full) * 100)
}

// Preço do anual dividido por 12, no formato da moeda do plano.
export function annualPerMonth(annual: WebPlan, locale = 'pt-BR'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: annual.currency }).format(annual.amountMicros / 12 / 1_000_000)
}

// Cria a compra web para uma conta. `app_user_id` = `users.id` (nunca anônimo, M3): o SDK é
// configurado já identificado, então o direito vai para a conta certa.
export function createRevenueCatWebPurchases(apiKey: string, userId: string): WebPurchases {
    // O SDK é pesado: só é baixado quando alguém abre a tela de planos.
    const instance = async (): Promise<Purchases> => {
        const { Purchases } = await import('@revenuecat/purchases-js')
        if (!Purchases.isConfigured()) return Purchases.configure({ apiKey, appUserId: userId })
        const shared = Purchases.getSharedInstance()
        if (shared.getAppUserId() !== userId) await shared.changeUser(userId)
        return shared
    }

    return {
        async loadPlans() {
            const offerings = await (await instance()).getOfferings()
            const packages = offerings.current?.availablePackages ?? []
            return packages.map(toPlan).filter((plan): plan is WebPlan => plan !== null)
        },
        async purchase(plan): Promise<PurchaseOutcome> {
            try {
                await (await instance()).purchase({ rcPackage: plan.handle as Package })
                return 'purchased'
            } catch (err) {
                const { ErrorCode, PurchasesError } = await import('@revenuecat/purchases-js')
                if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) return 'cancelled'
                throw err
            }
        },
    }
}
