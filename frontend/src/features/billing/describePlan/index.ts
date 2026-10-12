import type { BillingStatus, SubscriptionStore } from '../../../services/billing'
import type { NativePlatform } from '../isNativeApp'
import { SUPPORT_EMAIL } from '../../../utils/supportContact'

export interface PlanDescription {
    headline: string
    detail: string
    // Destino de gerenciar/cancelar: link externo (loja ou portal) ou rota interna.
    action: { label: string; href: string; external: boolean } | null
    // Instrução textual quando o destino não pode ser um link (promocional, ou pagamento web dentro do app).
    instruction: string | null
}

// Páginas oficiais de assinaturas de cada loja, usadas quando o provedor não devolve um link próprio.
export const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'
export const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions'

const PLAN_NAMES = { monthly: 'mensal', annual: 'anual' } as const

const STORE_LABELS: Record<SubscriptionStore, string> = {
    stripe: 'pela web',
    rc_billing: 'pela web',
    app_store: 'pela App Store',
    play_store: 'pelo Google Play',
    promotional: 'por uma concessão da equipe',
    other: 'em outra plataforma',
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR')
}

// Loja em que este app cobra (App Store no iOS, Google Play no Android).
const OWN_STORE: Record<NativePlatform, SubscriptionStore> = { ios: 'app_store', android: 'play_store' }

// Quem assinou por outra plataforma já é PRO aqui (o direito é da conta): o app avisa para não
// assinar de novo e nunca oferece nova compra, o que evitaria cobrança dupla.
function elsewhereNotice(status: BillingStatus, inApp: boolean, platform: NativePlatform | null): string | null {
    if (!inApp || !platform || !status.store || status.store === OWN_STORE[platform]) return null
    const origin: Partial<Record<SubscriptionStore, string>> = {
        app_store: 'pela App Store',
        play_store: 'pelo Google Play',
        stripe: 'pela web',
        rc_billing: 'pela web',
    }
    const where = origin[status.store]
    return where ? `Você assinou ${where}. O seu PRO já vale aqui no app, não é preciso assinar de novo.` : null
}

function storeAction(status: BillingStatus, inApp: boolean): Pick<PlanDescription, 'action' | 'instruction'> {
    switch (status.store) {
        case 'app_store':
            return {
                action: { label: 'Gerenciar na App Store', href: status.managementUrl ?? APP_STORE_SUBSCRIPTIONS_URL, external: true },
                instruction: null,
            }
        case 'play_store':
            return {
                action: { label: 'Gerenciar no Google Play', href: status.managementUrl ?? PLAY_STORE_SUBSCRIPTIONS_URL, external: true },
                instruction: null,
            }
        case 'stripe':
        case 'rc_billing':
            // Dentro do app não pode haver caminho de pagamento web (regra das lojas): só a instrução.
            if (inApp)
                return {
                    action: null,
                    instruction: 'Você assinou pela web. Para mudar ou cancelar, abra o site no navegador do seu celular ou computador.',
                }
            return status.managementUrl
                ? { action: { label: 'Gerenciar assinatura', href: status.managementUrl, external: true }, instruction: null }
                : { action: null, instruction: `Para mudar ou cancelar, fale com o suporte (${SUPPORT_EMAIL}).` }
        case 'promotional':
            return { action: null, instruction: 'Este PRO foi concedido pela equipe e não precisa de cancelamento.' }
        default:
            return { action: null, instruction: 'Para mudar ou cancelar, use a plataforma em que você assinou.' }
    }
}

// Bloco "Seu plano" de Configurações (MO.3.3): o texto e o destino certos para cada estado e
// para cada loja de origem. Cancelar nunca apaga progresso, e o texto sempre diz isso.
export function describePlan(status: BillingStatus, inApp: boolean, platform: NativePlatform | null = null): PlanDescription {
    const planName = status.plan && status.plan !== 'unknown' ? ` ${PLAN_NAMES[status.plan]}` : ''
    const origin = status.store ? ` ${STORE_LABELS[status.store]}` : ''
    const baseManage = storeAction(status, inApp)
    const notice = status.state === 'active' || status.state === 'billing_issue' ? elsewhereNotice(status, inApp, platform) : null
    const manage = {
        action: baseManage.action,
        instruction: notice ? [notice, baseManage.instruction].filter(Boolean).join(' ') : baseManage.instruction,
    }

    if (status.state === 'none') {
        return {
            headline: 'Plano grátis',
            detail: 'Você usa tudo o que é essencial sem pagar. O PRO deixa a plataforma mais divertida com os amigos.',
            action: { label: 'Conhecer o PRO', href: '/planos', external: false },
            instruction: null,
        }
    }
    if (status.state === 'expired') {
        return {
            headline: 'Seu PRO terminou',
            detail: `${status.expiresAt ? `Terminou em ${formatDate(status.expiresAt)}. ` : ''}Nada do que você conquistou foi apagado. Se quiser, é só voltar.`,
            action: { label: 'Ver os planos', href: '/planos', external: false },
            instruction: null,
        }
    }
    if (status.state === 'billing_issue') {
        return {
            headline: `PRO${planName}: problema no pagamento`,
            detail: 'Não conseguimos cobrar a sua assinatura. Atualize a forma de pagamento para manter o PRO.',
            ...manage,
        }
    }
    const when = status.expiresAt
        ? status.willRenew
            ? `Renova em ${formatDate(status.expiresAt)}.`
            : `PRO até ${formatDate(status.expiresAt)}.`
        : 'Sem data de término.'
    return { headline: `PRO${planName}`, detail: `Assinado${origin}. ${when}`, ...manage }
}
