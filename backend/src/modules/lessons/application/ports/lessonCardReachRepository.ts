import type { CardPosition, CardReachRow } from '../../domain/cardReach'

// Funil por cartão (LJ.5.1). Só contagem agregada por dia; quem já chegou onde fica numa tabela
// à parte pra cada pessoa contar uma vez por cartão.
export interface LessonCardReachRepository {
  // Registra que o usuário chegou ao cartão. Só conta (e devolve `true`) se o cartão está além do
  // mais avançado que ele já tinha alcançado na lição; reenvio, volta e releitura devolvem `false`
  // sem gravar. Atômico: duas requisições concorrentes não contam a mesma pessoa duas vezes.
  recordReach(input: {
    userId: string
    lessonId: string
    position: CardPosition
    day: string
  }): Promise<boolean>
  // Chegadas por cartão e dia, a partir de `sinceDay` (inclusive).
  listReach(lessonId: string, sinceDay: string): Promise<CardReachRow[]>
}
