import {
  isStreakReminderDue,
  lastActivityDayForReminder,
  MIN_STREAK_FOR_REMINDER,
  streakReminderDay,
} from '../../domain/engagement/streakReminder'
import type { StreakReminderAudience } from '../ports/streakReminderAudience'
import type { EnqueueEmailUseCase } from './enqueueEmail'

const PAGE_SIZE = 200

export interface SendStreakRemindersResult {
  due: boolean
  considered: number
  enqueued: number
  skipped: number
  failed: number
}

// Lembrete de sequência em risco (EM.7.3, E13, D9): um convite, nunca uma cobrança. Só para quem
// ligou o e-mail de engajamento, com sequência de pelo menos `MIN_STREAK_FOR_REMINDER` dias e que
// ainda não cumpriu a atividade de hoje (a audiência só traz quem fez a última ontem; conta
// suspensa não passa pelo enfileiramento). **Teto de 1 por pessoa por dia** pela chave
// `streak-reminder:<usuário>:<dia>`: a checagem roda várias vezes na janela e reiniciar ou ter
// réplicas nunca duplica.
export class SendStreakRemindersUseCase {
  constructor(
    private readonly audience: StreakReminderAudience,
    private readonly enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<SendStreakRemindersResult> {
    const now = this.now()
    const result: SendStreakRemindersResult = {
      due: isStreakReminderDue(now),
      considered: 0,
      enqueued: 0,
      skipped: 0,
      failed: 0,
    }
    if (!result.due) return result

    const day = streakReminderDay(now)
    const criteria = {
      lastActivityDay: lastActivityDayForReminder(now),
      minStreak: MIN_STREAK_FOR_REMINDER,
    }
    let cursor: string | null = null
    for (;;) {
      const page = await this.audience.listPage(cursor, PAGE_SIZE, criteria)
      for (const candidate of page) {
        result.considered += 1
        try {
          const outcome = await this.enqueueEmail.execute({
            userId: candidate.userId,
            to: candidate.address,
            templateKey: 'streak_reminder',
            category: 'engagement',
            payload: { name: candidate.name, streak: candidate.currentStreak },
            idempotencyKey: `streak-reminder:${candidate.userId}:${day}`,
          })
          if (outcome.status === 'enqueued') result.enqueued += 1
          else result.skipped += 1
        } catch (err) {
          result.failed += 1
          console.error(
            `[email] falha ao enfileirar o lembrete de sequência de ${candidate.userId}`,
            err,
          )
        }
      }
      if (page.length < PAGE_SIZE) break
      cursor = page[page.length - 1].userId
    }
    return result
  }
}
