import type {
  AdminOverview,
  AdminPuzzleView,
  DailyAdmin,
  DailyMetricsDay,
  DailyQuestion,
  DailyWord,
  DraftResult,
  QuestionInput,
  QuestionPatch,
  ReplaceCardInput,
  StartDateResult,
  WordInput,
  WordPatch,
} from '../ports/dailyAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Leituras do painel do Diário: sem auditoria, só repassam ao módulo dono.
export class DailyAdminReadsUseCase {
  constructor(private readonly daily: DailyAdmin) {}

  overview(): Promise<AdminOverview> {
    return this.daily.overview()
  }
  metrics(days?: number): Promise<DailyMetricsDay[]> {
    return this.daily.metrics(days)
  }
  puzzle(number: number): Promise<AdminPuzzleView> {
    return this.daily.getPuzzle(number)
  }
  words(): Promise<DailyWord[]> {
    return this.daily.listWords()
  }
  questions(): Promise<DailyQuestion[]> {
    return this.daily.listQuestions()
  }
  acceptedExtra(): Promise<string[]> {
    return this.daily.listAcceptedExtra()
  }
}

// Estreia (DI.5.1): preparar rascunho e agendar, mudar ou desligar. Toda ação é auditada, inclusive
// a recusada (30 dias, data no passado, já no ar), com a mensagem do domínio.
export class DailyLaunchAdminUseCase {
  constructor(
    private readonly daily: DailyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  prepareDraft(adminId: string, startDate: string): Promise<DraftResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.draft',
        targetType: 'daily_settings',
        payload: { start_date: startDate },
      },
      () => this.daily.prepareDraft(startDate),
      (result) => ({ payload: { created: result.created, warnings: result.warnings.length } }),
    )
  }

  setStartDate(adminId: string, startDate: string | null): Promise<StartDateResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.start_date',
        targetType: 'daily_settings',
        payload: { start_date: startDate },
      },
      () => this.daily.setStartDate(adminId, startDate),
      (result) => ({ payload: { status: result.status, published: result.published.length } }),
    )
  }
}

// Jogos do dia (DI.5.1): revisar, publicar e trocar um cartão. A auditoria leva o número do jogo
// e nunca o gabarito.
export class DailyPuzzleAdminUseCase {
  constructor(
    private readonly daily: DailyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  publish(adminId: string, numbers?: number[]): Promise<{ published: number[] }> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.puzzle_publish',
        targetType: 'daily_puzzle',
        payload: { requested: numbers ?? 'all_pending' },
      },
      () => this.daily.publishPuzzles(numbers),
      (result) => ({ payload: { published: result.published } }),
    )
  }

  replaceCard(
    adminId: string,
    number: number,
    input: ReplaceCardInput,
    confirmPublished: boolean,
  ): Promise<{ number: number }> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.puzzle_card',
        targetType: 'daily_puzzle',
        targetId: String(number),
        payload: { card: input.card, confirmed_published: confirmPublished },
      },
      () => this.daily.replaceCard(number, input, confirmPublished),
    )
  }
}

// camelCase do domínio -> snake_case do log, só nomes de campo (nunca o texto).
function snake(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// Conteúdo do Diário (DI.5.1): palavras, lista extra e perguntas. A auditoria leva a chave
// estável do item e os campos que mudaram, nunca o texto.
export class DailyContentAdminUseCase {
  constructor(
    private readonly daily: DailyAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  createWord(adminId: string, input: WordInput): Promise<DailyWord> {
    return this.recordAdminAction.run(
      { adminId, action: 'daily.word_create', targetType: 'daily_word' },
      () => this.daily.createWord(input),
      (word) => ({ targetId: word.id, payload: { stable_key: word.stableKey } }),
    )
  }

  updateWord(adminId: string, id: string, patch: WordPatch, confirm: boolean) {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.word_update',
        targetType: 'daily_word',
        targetId: id,
        payload: { confirmed_published: confirm },
      },
      () => this.daily.updateWord(adminId, id, patch, confirm),
      (result) => ({
        payload: {
          stable_key: result.item.stableKey,
          changed_fields: result.changedFields.map(snake),
          affected_puzzles: result.affectedPuzzles,
        },
      }),
    )
  }

  addAcceptedWord(adminId: string, word: string): Promise<{ word: string }> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.accepted_word_add',
        targetType: 'daily_accepted_word',
        targetId: word,
      },
      () => this.daily.addAcceptedWord(word),
    )
  }

  removeAcceptedWord(adminId: string, word: string): Promise<{ word: string }> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.accepted_word_remove',
        targetType: 'daily_accepted_word',
        targetId: word,
      },
      () => this.daily.removeAcceptedWord(word),
    )
  }

  createQuestion(adminId: string, input: QuestionInput): Promise<DailyQuestion> {
    return this.recordAdminAction.run(
      { adminId, action: 'daily.question_create', targetType: 'daily_question' },
      () => this.daily.createQuestion(input),
      (q) => ({ targetId: q.id, payload: { stable_key: q.stableKey } }),
    )
  }

  updateQuestion(adminId: string, id: string, patch: QuestionPatch, confirm: boolean) {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'daily.question_update',
        targetType: 'daily_question',
        targetId: id,
        payload: { confirmed_published: confirm },
      },
      () => this.daily.updateQuestion(adminId, id, patch, confirm),
      (result) => ({
        payload: {
          stable_key: result.item.stableKey,
          changed_fields: result.changedFields.map(snake),
          affected_puzzles: result.affectedPuzzles,
        },
      }),
    )
  }
}
