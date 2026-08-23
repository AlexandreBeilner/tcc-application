// InvalidMacroEventError representa uma rejeição de regra de negócio vinda
// do motor de simulação (macroevent.NewEvent/NewTarget, tarefa 4.1/4.2) —
// dupla validação documentada (backlog 4.4, critério de aceite): o Zod na
// borda HTTP já cobre formato/obrigatoriedade, mas só o motor sabe, por
// exemplo, se um template_key existe no catálogo (macroevent.Templates,
// 4.3). Lançada pelo adapter de infraestrutura (engineMacroEventTrigger),
// não pelo caso de uso — é a tradução de um 400 do motor pra um erro de
// domínio que o router sabe mapear de volta pra 400.
export class InvalidMacroEventError extends Error {}
