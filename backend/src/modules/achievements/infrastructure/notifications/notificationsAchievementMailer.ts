import type { RecipientDirectory } from '../../../notifications/application/ports/recipientDirectory'
import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { AchievementMailer } from '../../application/ports/achievementMailer'

export interface NotificationsAchievementMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute' | 'acceptsOptional'>
  recipients: RecipientDirectory
}

// Liga a port `AchievementMailer` ao módulo `notifications` (EM.7.2, E14). Categoria
// `engagement`: só sai para quem ligou o e-mail de engajamento (o `EnqueueEmailUseCase` decide).
// Idempotente por conquista: `achievement-rare:<usuário>:<conquista>`, então reprocessar o mesmo
// desbloqueio nunca manda dois e-mails.
export function createNotificationsAchievementMailer(
  options: NotificationsAchievementMailerOptions,
): AchievementMailer {
  return {
    async sendRareUnlocked({ userId, achievement }) {
      if (!(await options.enqueueEmail.acceptsOptional(userId, 'engagement'))) return
      const recipient = await options.recipients.find(userId)
      if (!recipient) return

      await options.enqueueEmail.execute({
        userId,
        to: recipient.address,
        templateKey: 'rare_achievement',
        category: 'engagement',
        payload: {
          name: recipient.name,
          achievementName: achievement.name,
          ...(achievement.description ? { achievementDescription: achievement.description } : {}),
        },
        idempotencyKey: `achievement-rare:${userId}:${achievement.id}`,
      })
    },
  }
}
