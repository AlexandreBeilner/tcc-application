import {
  buildCardFunnel,
  DEFAULT_FUNNEL_DAYS,
  MAX_FUNNEL_DAYS,
  reachDay,
  type LessonCardFunnel,
} from '../../domain/cardReach'
import { LessonNotFoundError } from '../../domain/errors'
import type { LessonCardReachRepository } from '../ports/lessonCardReachRepository'
import type { LessonCatalogRepository } from '../ports/lessonCatalogRepository'

const DAY_MS = 24 * 60 * 60 * 1000

// Funil por cartão de uma lição pro painel (LJ.5.1): quantas pessoas chegaram a cada cartão nos
// últimos `days` dias. Enxerga lição despublicada também (o catálogo do admin).
export class GetLessonCardFunnelUseCase {
  constructor(
    private readonly catalog: LessonCatalogRepository,
    private readonly cardReach: LessonCardReachRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(lessonId: string, requestedDays?: number): Promise<LessonCardFunnel> {
    const lesson = await this.catalog.findById(lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    const days = Math.min(Math.max(requestedDays ?? DEFAULT_FUNNEL_DAYS, 1), MAX_FUNNEL_DAYS)
    // `days` dias contando hoje: 1 = só hoje.
    const since = reachDay(new Date(this.clock().getTime() - (days - 1) * DAY_MS))
    const rows = await this.cardReach.listReach(lessonId, since)
    return {
      lesson: { id: lesson.id, code: lesson.code, title: lesson.title },
      days,
      since,
      ...buildCardFunnel(rows),
    }
  }
}
