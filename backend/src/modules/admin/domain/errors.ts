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
