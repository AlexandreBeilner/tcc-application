import { digestWeekKey, isWeeklyDigestDue } from '../../domain/engagement/weeklyDigest'
import type { WeeklyDigestAudience } from '../ports/weeklyDigestAudience'
import type { EnqueueEmailUseCase } from './enqueueEmail'

const PAGE_SIZE = 200

export interface SendWeeklyDigestResult {
  due: boolean
  considered: number
  enqueued: number
  // Já enfileirado nesta semana (o job roda várias vezes na janela) ou barrado pelo
  // enfileiramento (preferência desligada entre a leitura e o envio, endereço suprimido).
  skipped: number
  failed: number
}

// Resumo semanal (EM.7.1, E12): segunda de manhã, só para quem ligou o e-mail de engajamento. O
// job chama isto várias vezes por dia; fora da janela não faz nada, e dentro dela a chave de
// idempotência `weekly-digest:<usuário>:<segunda>` garante um e-mail por pessoa por semana mesmo
// que o processo reinicie ou haja mais de uma réplica.
export class SendWeeklyDigestUseCase {
  constructor(
    private readonly audience: WeeklyDigestAudience,
    private readonly enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<SendWeeklyDigestResult> {
    const now = this.now()
    const result: SendWeeklyDigestResult = {
      due: isWeeklyDigestDue(now),
      considered: 0,
      enqueued: 0,
      skipped: 0,
      failed: 0,
    }
    if (!result.due) return result

    const week = digestWeekKey(now)
    let cursor: string | null = null
    for (;;) {
      const page = await this.audience.listPage(cursor, PAGE_SIZE)
      for (const candidate of page) {
        result.considered += 1
        try {
          const outcome = await this.enqueueEmail.execute({
            userId: candidate.userId,
            to: candidate.address,
            templateKey: 'weekly_digest',
            category: 'engagement',
            payload: {
              name: candidate.name,
              level: candidate.level,
              ...(candidate.weeklyReturnPct !== null
                ? { weeklyReturnPct: candidate.weeklyReturnPct }
                : {}),
              pendingMissions: candidate.pendingMissions,
              ...(candidate.pendingMissionTitle
                ? { missionTitle: candidate.pendingMissionTitle }
                : {}),
            },
            idempotencyKey: `weekly-digest:${candidate.userId}:${week}`,
          })
          if (outcome.status === 'enqueued') result.enqueued += 1
          else result.skipped += 1
        } catch (err) {
          // Um usuário com problema nunca impede o resumo dos outros.
          result.failed += 1
          console.error(`[email] falha ao enfileirar o resumo semanal de ${candidate.userId}`, err)
        }
      }
      if (page.length < PAGE_SIZE) break
      cursor = page[page.length - 1].userId
    }
    return result
  }
}
