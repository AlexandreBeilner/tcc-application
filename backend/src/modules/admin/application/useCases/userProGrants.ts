import type { UserRepository } from '../../../auth/application/ports/userRepository'
import {
  AdminCorrectionConflictError,
  AdminUserNotFoundError,
  ProGrantRejectedError,
} from '../../domain/errors'
import type { UserProGrants, UserProStatus } from '../ports/userProGrants'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Teto por concessão (decisão do autor, 2026-10-11). Concessões empilham, então um período maior
// se faz repetindo, com motivo e senha recente a cada vez.
export const MAX_PRO_GRANT_DAYS = 90
const DAY_MS = 86_400_000
// Acesso sem vencimento (vitalício) vem como um instante no ano 9999 ou depois.
const LIFETIME_YEAR = 9999

export class GetUserProStatusUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly proGrants: UserProGrants,
  ) {}

  async execute(targetUserId: string): Promise<UserProStatus> {
    const user = await this.userRepository.findById(targetUserId)
    if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
    return this.proGrants.statusOf(targetUserId)
  }
}

export interface GrantUserProResult {
  endsAt: Date
  previousAccessEnd: Date | null
}

// Concede PRO promocional por N dias (MO.2.5). A concessão empilha: conta a partir do fim do acesso
// atual (assinatura paga ou concessão anterior), nunca por cima dele, então não encurta nada. O
// motivo e o período vão para a auditoria `billing.grant_promotional`.
export class GrantUserProUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly proGrants: UserProGrants,
    private readonly recordAdminAction: RecordAdminActionUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    adminId: string,
    targetUserId: string,
    input: { days: number; reason: string },
  ): Promise<GrantUserProResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'billing.grant_promotional',
        targetType: 'user',
        targetId: targetUserId,
        payload: { days: input.days, reason: input.reason },
      },
      async () => {
        if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_PRO_GRANT_DAYS) {
          throw new ProGrantRejectedError(`o período deve ter de 1 a ${MAX_PRO_GRANT_DAYS} dias`)
        }
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')

        const previousAccessEnd = await this.proGrants.currentAccessEnd(targetUserId)
        if (previousAccessEnd && previousAccessEnd.getUTCFullYear() >= LIFETIME_YEAR) {
          throw new AdminCorrectionConflictError('esta pessoa já tem PRO sem vencimento')
        }
        const now = this.now()
        const base = previousAccessEnd && previousAccessEnd > now ? previousAccessEnd : now
        const endsAt = new Date(base.getTime() + input.days * DAY_MS)
        await this.proGrants.grantUntil(targetUserId, endsAt)
        return { endsAt, previousAccessEnd }
      },
      (result) => ({
        payload: {
          ends_at: result.endsAt.toISOString(),
          previous_access_end: result.previousAccessEnd?.toISOString() ?? null,
        },
      }),
    )
  }
}
