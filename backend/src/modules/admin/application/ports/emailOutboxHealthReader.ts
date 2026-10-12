import type { OutboxStats } from '../../domain/systemHealth'

// Contadores da fila de e-mail (EM.8.1). O adapter lê a tabela do módulo `notifications` só
// pra contar; o admin não conhece o outbox além disso.
export interface EmailOutboxHealthReader {
  read(now: Date): Promise<OutboxStats>
}
