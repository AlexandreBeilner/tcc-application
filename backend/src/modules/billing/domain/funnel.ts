import type { ProLifecycleEmail } from './lifecycleEmails'
import { isActive } from './subscription'
import type { Subscription } from './subscription'

// Funil de conversão do PRO (MO.1.3/MO.7.1). Funções puras: nomes de evento, pontos de convite e o
// cálculo das métricas do painel. Nenhum evento carrega valor em reais nem patrimônio (RNF09).

// Por quanto tempo os eventos ficam (ponto 048, decisão do autor em 2026-10-11): depois disso são
// apagados. A conta excluída é anonimizada (sem nome, e-mail nem username), então o que sobra de
// evento dela dentro do prazo já não identifica ninguém.
export const FUNNEL_RETENTION_MONTHS = 12

// Quem reporta cada evento: os três primeiros vêm do cliente (`POST /billing/funnel`); `subscribed`
// e `cancelled` só o servidor grava, a partir do ciclo de vida da assinatura.
export const CLIENT_FUNNEL_EVENTS = ['invite_viewed', 'plans_opened', 'purchase_started'] as const
export type ClientFunnelEvent = (typeof CLIENT_FUNNEL_EVENTS)[number]
export type FunnelEventName = ClientFunnelEvent | 'subscribed' | 'cancelled'

// Ponto do app de onde a pessoa chegou ao PRO: os quatro convites (cada um é uma âncora do plano) e
// `direct` (abriu /planos sem passar por um convite, ex.: pelo menu de configurações).
export const FUNNEL_SOURCES = [
  'league',
  'duel',
  'cosmetics',
  'retrospective',
  'assembly',
  'direct',
] as const
export type FunnelSource = (typeof FUNNEL_SOURCES)[number]

export interface FunnelEvent {
  userId: string
  name: FunnelEventName
  source: FunnelSource | null
  plan: Subscription['period'] | null
  // Torna a gravação idempotente (a mesma chave nunca grava duas vezes).
  dedupeKey: string
  at: Date
}

// No máximo um evento do cliente por pessoa, nome, origem e dia (UTC): reabrir a tela não infla o
// funil e o cliente não consegue encher a tabela.
export function clientEventKey(
  userId: string,
  name: ClientFunnelEvent,
  source: FunnelSource | null,
  at: Date,
): string {
  return `${name}:${userId}:${source ?? 'none'}:${at.toISOString().slice(0, 10)}`
}

// Passos do funil, em pessoas distintas na janela.
export interface FunnelSteps {
  lessonCompleted: number
  inviteViewed: number
  plansOpened: number
  purchaseStarted: number
  subscribed: number
  cancelled: number
}

export interface SourceFunnel {
  source: FunnelSource
  // Pessoas distintas com qualquer evento neste ponto (base da taxa de conversão).
  reached: number
  inviteViewed: number
  plansOpened: number
  purchaseStarted: number
  // Quem teve contato com este ponto e assinou depois (uma pessoa pode contar em mais de um ponto).
  subscribed: number
}

export interface FunnelSummary {
  steps: FunnelSteps
  bySource: SourceFunnel[]
}

export interface BillingPrices {
  // Em centavos. Vêm só da configuração (o preço real vive nas lojas), nunca de texto fixo.
  monthlyCents: number | null
  annualCents: number | null
}

export interface BillingMetrics {
  windowDays: number
  generatedAt: string
  subscribers: { active: number; monthly: number; annual: number; unknown: number }
  // `null` sem preços configurados ou sem base para calcular.
  recurringRevenueCents: number | null
  churn: { cancelled: number; startOfWindow: number; rate: number | null }
  funnel: FunnelSteps
  bySource: Array<SourceFunnel & { conversionRate: number | null }>
}

// Assinatura de verdade: concessão promocional e conta de teste das lojas não são cliente pagante.
export function isPayingSubscription(subscription: Subscription): boolean {
  return !subscription.isSandbox && subscription.store !== 'promotional'
}

// Os mesmos fatos que geram o e-mail de boas-vindas e o de encerramento viram os eventos "assinou" e
// "cancelou", com a chave do fato (reconciliar ou receber o webhook em dobro não duplica). Conta
// de teste das lojas e concessão promocional ficam de fora: não são cliente pagante.
export function lifecycleFunnelEvent(
  email: ProLifecycleEmail,
  subscription: Subscription,
  at: Date,
): FunnelEvent | null {
  if (!isPayingSubscription(subscription)) return null
  if (email.kind === 'welcome') {
    return {
      userId: subscription.userId,
      name: 'subscribed',
      source: null,
      plan: email.plan,
      dedupeKey: `subscribed:${email.key}`,
      at,
    }
  }
  if (email.kind === 'ended') {
    return {
      userId: subscription.userId,
      name: 'cancelled',
      source: null,
      plan: subscription.period,
      dedupeKey: `cancelled:${email.key}`,
      at,
    }
  }
  return null
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

export function buildBillingMetrics(input: {
  subscriptions: Subscription[]
  summary: FunnelSummary
  prices: BillingPrices
  windowDays: number
  now: Date
}): BillingMetrics {
  const { subscriptions, summary, prices, windowDays, now } = input
  const active = subscriptions.filter((s) => isPayingSubscription(s) && isActive(s, now))
  const monthly = active.filter((s) => s.period === 'monthly').length
  const annual = active.filter((s) => s.period === 'annual').length
  const unknown = active.length - monthly - annual

  const { monthlyCents, annualCents } = prices
  // Receita recorrente mensal estimada: mensal pelo preço cheio, anual dividido por 12. Plano
  // desconhecido fica fora da conta (aparece em `unknown`).
  const recurringRevenueCents =
    monthlyCents === null || annualCents === null
      ? null
      : Math.round(monthly * monthlyCents + (annual * annualCents) / 12)

  // Base do churn: quem estava ativo no começo da janela, reconstruído a partir de agora
  // (ativos hoje - quem assinou na janela + quem cancelou na janela).
  const startOfWindow = Math.max(
    active.length - summary.steps.subscribed + summary.steps.cancelled,
    0,
  )

  return {
    windowDays,
    generatedAt: now.toISOString(),
    subscribers: { active: active.length, monthly, annual, unknown },
    recurringRevenueCents,
    churn: {
      cancelled: summary.steps.cancelled,
      startOfWindow,
      rate: ratio(summary.steps.cancelled, startOfWindow),
    },
    funnel: summary.steps,
    bySource: summary.bySource.map((row) => ({
      ...row,
      conversionRate: ratio(row.subscribed, row.reached),
    })),
  }
}
