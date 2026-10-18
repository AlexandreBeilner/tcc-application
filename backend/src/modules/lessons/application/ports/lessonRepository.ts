import type {
  CheckpointLastResponse,
  CheckpointRecord,
  LessonProgressSnapshot,
  LessonSummary,
  UserCheckpointRecord,
} from '../../domain/lesson'

export interface LessonProgressRecord extends LessonProgressSnapshot {
  lessonId: string
  // Revisão voluntária de lição já concluída (H.2) — `null` até a primeira
  // vez que o usuário reabre e re-percorre a lição depois de concluída.
  lastReviewedAt: Date | null
}

export interface UpsertProgressInput {
  currentStep: number
  completedAt: Date | null
  // Opcional e distinto de `null` (B.1): `undefined` (campo ausente) não
  // mexe no valor já gravado — cada transição de passo chama `upsertProgress`
  // de novo, e sem essa distinção uma chamada sem a escolha (ex: avançar do
  // passo Revelação pro Desbloqueio) apagaria a escolha feita no passo
  // Micro-decisão. Só a B.2 (`AdvanceLessonUseCase`) passa isto de verdade;
  // aqui é só o encanamento do repositório.
  microDecisionSelectedOption?: number | null
}

export interface CompletionAttemptResult {
  record: LessonProgressRecord
  // `false` quando a linha já tinha `completedAt` setado por outra
  // requisição concorrente que venceu a corrida — quem chama não deve
  // creditar xp/streak/trilha de novo nesse caso (RC ver `advanceLesson.ts`).
  wonRace: boolean
}

export interface LessonRepository {
  // Lições publicadas, em ordem de `sortOrder` — a progressão (N.24) é
  // calculada sobre esta lista, então despublicar (N.18) é só filtrar aqui.
  listAll(): Promise<LessonSummary[]>
  findById(id: string): Promise<LessonSummary | undefined>
  listProgressForUser(userId: string): Promise<LessonProgressRecord[]>
  upsertProgress(
    userId: string,
    lessonId: string,
    input: UpsertProgressInput,
  ): Promise<LessonProgressRecord>
  // Transição atômica de "não concluída" pra "concluída" — só marca
  // `completedAt` (e devolve `wonRace: true`) se a linha ainda não tinha
  // `completedAt` setado; duas requisições concorrentes completando a mesma
  // lição só deixam uma vencer (mesmo padrão do `setWhere` em
  // `drizzleMissionRepository.markCompleted`, que existe pelo mesmo motivo:
  // evitar xp em dobro).
  completeIfNotAlreadyCompleted(
    userId: string,
    lessonId: string,
    currentStep: number,
    completedAt: Date,
    // Mesma convenção `undefined` !== `null` de `UpsertProgressInput` acima —
    // uma chamada que conclui a lição sem reenviar `selectedOption` (ex:
    // escolha já persistida num passo anterior) não deve apagar o valor
    // gravado.
    microDecisionSelectedOption?: number,
  ): Promise<CompletionAttemptResult>
  // Só grava `lastReviewedAt` — não mexe em `currentStep`/`completedAt`
  // (aqueles continuam sendo responsabilidade de `upsertProgress`). Requer
  // que a linha já exista (`ReviewLessonUseCase` garante isso checando
  // `completedAt !== null` antes de chamar).
  markReviewed(userId: string, lessonId: string, reviewedAt: Date): Promise<void>
  // Registra uma resposta da pergunta (RC.2.3), atomicamente e sem tocar
  // `updatedAt` (senão reiniciaria o intervalo mínimo entre passos). Primeira
  // resposta fixa `microDecisionSelectedOption` (imutável depois); toda
  // resposta incrementa `microDecisionAttempts`; erro acrescenta a alternativa
  // a `microDecisionWrongOptions`; acerto grava `microDecisionSolvedAt`. Só
  // age em linha ainda não resolvida: se já estava resolvida (ou a linha não
  // existe) devolve o estado atual sem escrever.
  recordMicroDecisionAnswer(
    userId: string,
    lessonId: string,
    answer: { selectedOption: number; correct: boolean; answeredAt: Date },
  ): Promise<LessonProgressRecord | undefined>
  listCheckpointsForUser(userId: string, lessonId: string): Promise<CheckpointRecord[]>
  // Todas as perguntas já respondidas pela pessoa, de qualquer lição ("Relembra?", LJ.5.5).
  listAllCheckpointsForUser(userId: string): Promise<UserCheckpointRecord[]>
  // Perguntas da fila de revisão (LJ.5.6) com `reviewDueAt` até `now`, as vencidas há mais tempo primeiro.
  listDueReviewsForUser(userId: string, now: Date, limit: number): Promise<UserCheckpointRecord[]>
  // Reagenda uma revisão só se ela ainda estiver vencida com o `expectedDueAt` lido (duas respostas
  // concorrentes não avançam duas vezes). `next.dueAt` nulo tira a pergunta da fila. Devolve se gravou.
  scheduleReview(
    userId: string,
    lessonId: string,
    checkpointId: string,
    next: { stage: number; dueAt: Date | null },
    expectedDueAt: Date,
  ): Promise<boolean>
  // Registra uma tentativa de pergunta intermediária (RC.3.2), atomicamente:
  // cria a linha na primeira tentativa, incrementa `attempts`, acrescenta
  // `choice` (alternativa errada; `null` em erro numérico) a `wrongOptions` e
  // grava `solvedAt` no acerto. Só age em checkpoint ainda não resolvido:
  // resolvido, devolve o estado atual sem escrever.
  recordCheckpointAnswer(
    userId: string,
    lessonId: string,
    checkpointId: string,
    answer: {
      choice: number | null
      correct: boolean
      answeredAt: Date
      // Formatos que resolvem na 1ª resposta mesmo sem acertar (estimativa, LJ-D1): grava
      // `solvedAt` com `correct` falso. Omitido, vale `correct`.
      solved?: boolean
      // Resolvida depois de errar (LJ.5.6): entra na fila de revisão, voltando neste instante.
      reviewDueAt?: Date
      lastResponse?: CheckpointLastResponse
    },
  ): Promise<CheckpointRecord>
}
