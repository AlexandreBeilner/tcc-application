// Evento do provedor já traduzido pro nosso vocabulário: o resto do módulo nunca vê o formato
// do Resend (EM.1.4).
export type ProviderEvent =
  // Entrega confirmada pelo servidor de e-mail do destinatário.
  | { type: 'delivered'; providerMessageId: string }
  // `permanent`: o endereço não existe ou recusou de vez. Bounce transitório (caixa cheia,
  // servidor fora) o provedor mesmo tenta de novo, então não suprime.
  | { type: 'bounced'; providerMessageId: string; recipients: string[]; permanent: boolean }
  | { type: 'complained'; providerMessageId: string; recipients: string[] }
  // Qualquer outro evento (aberto, clicado, atrasado...): aceito e ignorado.
  | { type: 'ignored' }
