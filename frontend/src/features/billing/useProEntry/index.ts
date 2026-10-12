import { useBillingStatusQuery } from '../useBillingStatus'

// Como as entradas sempre visíveis do PRO (MO.9.8: menu do avatar, cabeçalho) tratam a pessoa:
// `subscriber` vê "Gerenciar plano" e o selo; `visitor` vê o convite ao plano; `null` não mostra
// nada (carregando, ou cobrança desligada para quem nunca assinou).
export type ProEntry = 'subscriber' | 'visitor' | null

export function useProEntry(): ProEntry {
    const billing = useBillingStatusQuery().data
    if (!billing) return null
    if (billing.isPro) return 'subscriber'
    return billing.billingEnabled ? 'visitor' : null
}
