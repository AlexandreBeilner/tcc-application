import { buildReviewSession, REVIEW_SESSION_SIZE } from '../../domain/review'
import type { ReviewQuestion } from '../../domain/review'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetReviewSessionInput {
  userId: string
}

export interface ReviewSessionView {
  // Só `true` com ao menos `REVIEW_SESSION_SIZE` perguntas vencidas: o cartão do hub não aparece antes disso e
  // nunca mostra contagem de pendências (sem cobrança).
  ready: boolean
  questions: ReviewQuestion[]
}

// Revisão de 1 minuto (LJ.5.6): três perguntas que a pessoa já resolveu depois de errar e que chegaram ao dia de
// voltar. Só leitura: responder segue pela rota de checkpoint (com `practice`) e o resultado vai para a rota de
// revisão. A busca pega mais do que o necessário porque pergunta que sumiu do conteúdo é descartada.
const FETCH_LIMIT = 30

export class GetReviewSessionUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: GetReviewSessionInput): Promise<ReviewSessionView> {
    const [due, lessons] = await Promise.all([
      this.lessonRepository.listDueReviewsForUser(input.userId, this.clock(), FETCH_LIMIT),
      this.lessonRepository.listAll(),
    ])
    if (due.length < REVIEW_SESSION_SIZE) {
      return { ready: false, questions: [] }
    }
    const questions = buildReviewSession(due, lessons)
    return { ready: questions.length === REVIEW_SESSION_SIZE, questions }
  }
}
