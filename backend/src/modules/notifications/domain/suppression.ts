import { isOptionalCategory, type EmailCategory } from './emailMessage'

// Por que um endereço não deve receber e-mail (EM.1.4). `bounce` = o provedor disse que o
// endereço não existe/não entrega; `complaint` = a pessoa marcou nosso e-mail como spam;
// `unsubscribe_all` = pediu pra sair de tudo que é opcional (EM.6.1).
export const SUPPRESSION_REASONS = ['bounce', 'complaint', 'unsubscribe_all'] as const
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number]

// `bounce` barra tudo, inclusive segurança: tentar de novo num endereço inexistente só piora a
// reputação do domínio. `complaint` e `unsubscribe_all` barram só o que é opcional: quem
// reclamou de um resumo semanal ainda precisa receber o link de recuperação de senha.
export function isBlockedBySuppression(
  reason: SuppressionReason,
  category: EmailCategory,
): boolean {
  return reason === 'bounce' || isOptionalCategory(category)
}

// Por que uma linha do outbox virou `suppressed` sem ser enviada: um dos motivos acima, ou
// `unsubscribed` (a pessoa desligou a categoria depois que o e-mail entrou na fila, EM.6.1).
export type SkipReason = SuppressionReason | 'unsubscribed'
