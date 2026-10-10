import type { AdminAuditAction } from '../../domain/auditEntry'
import type { AuditLogRepository } from '../ports/auditLogRepository'

export interface AuditedActionSpec {
  adminId: string
  action: AdminAuditAction
  targetType: string
  targetId?: string
  payload?: Record<string, unknown>
}

// O que só se sabe depois da operação (id do evento criado, dia do tick).
export interface AuditedActionOutcome {
  targetId?: string
  payload?: Record<string, unknown>
}

// Ponto único de gravação do log de auditoria (N.4): os casos de uso do
// módulo `admin` chamam `run` em volta da operação mutável em vez de
// gravar direto, pra a regra "nenhuma escrita sem auditoria" ficar num lugar
// só. Registra `success` ou `failed` (com a mensagem) e sempre devolve ou
// relança o resultado original — falha de auditoria nunca troca a resposta
// de uma ação que já aconteceu no motor: é logada com destaque e a resposta
// segue (o contrário faria um tick bem-sucedido virar 500 e ser repetido).
export class RecordAdminActionUseCase {
  constructor(private readonly auditLog: AuditLogRepository) {}

  async run<T>(
    spec: AuditedActionSpec,
    operation: () => Promise<T>,
    describeOutcome?: (result: T) => AuditedActionOutcome,
  ): Promise<T> {
    let result: T
    try {
      result = await operation()
    } catch (err) {
      await this.append({
        ...spec,
        result: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }

    const outcome = describeOutcome?.(result) ?? {}
    await this.append({
      ...spec,
      targetId: outcome.targetId ?? spec.targetId,
      payload: { ...spec.payload, ...outcome.payload },
      result: 'success',
    })
    return result
  }

  private async append(
    entry: AuditedActionSpec & { result: 'success' | 'failed'; errorMessage?: string },
  ): Promise<void> {
    try {
      await this.auditLog.append({
        adminId: entry.adminId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        payload: entry.payload ?? {},
        result: entry.result,
        errorMessage: entry.errorMessage,
      })
    } catch (auditErr) {
      console.error('[audit] falha ao gravar o log de auditoria', entry.action, auditErr)
    }
  }
}
