import type { UserRepository } from '../../../auth/application/ports/userRepository'
import type { AdminAuditAction } from '../../domain/auditEntry'
import { AdminUserNotFoundError } from '../../domain/errors'
import type {
  CorrectedProgression,
  UserCorrectionContext,
  UserCorrections,
} from '../ports/userCorrections'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Correções manuais de conta (N.17): XP, streak, conquistas e lições. Todas auditadas
// com motivo obrigatório (validado na borda HTTP) e feitas pelos casos de uso dos módulos
// donos do dado, via `UserCorrections`. A existência do usuário é checada dentro da
// operação auditada, pra a recusa também ficar no log.
abstract class UserCorrectionUseCase {
  constructor(
    protected readonly userRepository: UserRepository,
    protected readonly corrections: UserCorrections,
    protected readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  protected async audited<T>(
    adminId: string,
    userId: string,
    action: AdminAuditAction,
    payload: Record<string, unknown>,
    operation: () => Promise<T>,
    describeOutcome?: (result: T) => { payload: Record<string, unknown> },
  ): Promise<T> {
    return this.recordAdminAction.run(
      { adminId, action, targetType: 'user', targetId: userId, payload },
      async () => {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        return operation()
      },
      describeOutcome,
    )
  }
}

export class GetUserCorrectionContextUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly corrections: UserCorrections,
  ) {}

  async execute(userId: string): Promise<UserCorrectionContext> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
    return this.corrections.getContext(userId)
  }
}

export class AdjustUserXpUseCase extends UserCorrectionUseCase {
  execute(adminId: string, userId: string, input: { delta: number; reason: string }) {
    return this.audited(
      adminId,
      userId,
      'user.adjust_xp',
      { delta: input.delta, reason: input.reason },
      () => this.corrections.adjustXp(userId, input.delta),
      (result: CorrectedProgression) => ({ payload: { xp: result.xp, level: result.level } }),
    )
  }
}

export class SetUserStreakUseCase extends UserCorrectionUseCase {
  execute(adminId: string, userId: string, input: { value: number; reason: string }) {
    return this.audited(
      adminId,
      userId,
      'user.set_streak',
      { value: input.value, reason: input.reason },
      () => this.corrections.setStreak(userId, input.value),
    )
  }
}

export class GrantUserAchievementUseCase extends UserCorrectionUseCase {
  execute(adminId: string, userId: string, achievementId: string, reason: string) {
    return this.audited(
      adminId,
      userId,
      'user.grant_achievement',
      { achievement_id: achievementId, reason },
      () => this.corrections.grantAchievement(userId, achievementId),
      (result) => ({ payload: { achievement_name: result.name } }),
    )
  }
}

export class CompleteUserLessonUseCase extends UserCorrectionUseCase {
  execute(adminId: string, userId: string, lessonId: string, reason: string) {
    return this.audited(
      adminId,
      userId,
      'user.complete_lesson',
      { lesson_id: lessonId, reason },
      () => this.corrections.completeLesson(userId, lessonId),
      (result) => ({ payload: { lesson_code: result.code } }),
    )
  }
}

export class ReopenUserLessonUseCase extends UserCorrectionUseCase {
  execute(adminId: string, userId: string, lessonId: string, reason: string) {
    return this.audited(
      adminId,
      userId,
      'user.reopen_lesson',
      { lesson_id: lessonId, reason },
      () => this.corrections.reopenLesson(userId, lessonId),
      (result) => ({ payload: { lesson_code: result.code } }),
    )
  }
}
