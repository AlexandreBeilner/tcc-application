// InvalidMacroEventError representa uma rejeição de regra de negócio vinda
// do motor de simulação (macroevent.NewEvent/NewTarget, tarefa 4.1/4.2) —
// dupla validação documentada (backlog 4.4, critério de aceite): o Zod na
// borda HTTP já cobre formato/obrigatoriedade, mas só o motor sabe, por
// exemplo, se um template_key existe no catálogo (macroevent.Templates,
// 4.3). Lançada pelo adapter de infraestrutura (engineMacroEventTrigger),
// não pelo caso de uso — é a tradução de um 400 do motor pra um erro de
// domínio que o router sabe mapear de volta pra 400.
export class InvalidMacroEventError extends Error {}

// TickInProgressError representa o 409 que o motor devolve quando já existe
// um tick em andamento (agendado ou outro POST /admin/tick concorrente,
// tarefa S.3/trava consultiva do Postgres) — traduzido pelo adapter de
// infraestrutura (engineTickTrigger) pro router mapear de volta pra 409,
// mesmo raciocínio de InvalidMacroEventError pro 400.
export class TickInProgressError extends Error {}

// SchedulerDisabledError é o 409 do motor em pause/resume quando a agenda
// automática está desligada no ambiente (TICK_SCHEDULER_ENABLED=false, tarefa
// N.6): não há o que pausar. Traduzido pelo adapter pro router devolver 409.
export class SchedulerDisabledError extends Error {}

// TickAdvanceFailedError é a falha no meio de "avançar N dias" (tarefa N.6): o
// motor devolve os ticks que já rodaram antes do erro (ficam gravados, o
// mercado não volta atrás). Carregado aqui pra o painel mostrar até onde foi.
export class TickAdvanceFailedError extends Error {
  constructor(
    message: string,
    readonly completedTicks: unknown[],
  ) {
    super(message)
  }
}

// AdminAssetNotFoundError é o 404 do motor no monitor de mercado (N.8): o ativo não
// existe ou não é negociável (sandbox, renda fixa). Traduzido pelo adapter pro router
// devolver 404.
export class AdminAssetNotFoundError extends Error {}

// AdminOrderNotFoundError é o 404 do motor ao cancelar uma ordem que não existe (N.10).
export class AdminOrderNotFoundError extends Error {}

// AdminOrderNotCancellableError é o 409 do motor: a ordem já foi executada ou cancelada (N.10).
export class AdminOrderNotCancellableError extends Error {}

// BatchTooLargeError é o 422 do motor: o filtro do lote atinge mais ordens que o
// teto e nada foi cancelado (N.10). Carrega a contagem pro admin estreitar o filtro.
export class BatchTooLargeError extends Error {
  constructor(
    message: string,
    readonly matched: number,
    readonly max: number,
  ) {
    super(message)
  }
}

// TradingHaltConflictError é o 409 do motor: já existe pausa vigente no escopo, ou a
// pausa já foi encerrada (N.9).
export class TradingHaltConflictError extends Error {}

// TradingHaltNotFoundError é o 404 do motor: pausa ou ativo inexistente (N.9).
export class TradingHaltNotFoundError extends Error {}

// TradingHaltRejectedError é o 400 do motor: escopo, motivo ou ativo recusados pela
// regra de domínio (a borda Zod já cobre o formato; só o motor sabe, por exemplo, que
// um ativo de renda fixa não tem book) (N.9).
export class TradingHaltRejectedError extends Error {}

// BotNotFoundError é o 404 do motor: o bot não existe (N.1).
export class BotNotFoundError extends Error {}

// BotConflictError é o 409 do motor: ID de bot já existente ou ativo que já é coberto
// por outro Market Maker (N.1).
export class BotConflictError extends Error {}

// BotRejectedError é o 400 do motor: personalidade, caixa ou cobertura recusados pela regra
// de domínio (a borda Zod cobre o formato; só o motor sabe, por exemplo, que um ativo de
// renda fixa não pode ser coberto por Market Maker) (N.1).
export class BotRejectedError extends Error {}
