// Forma mínima que redactPending precisa enxergar — declarada aqui (não
// importada de application/ports) porque domain/ não pode depender de outra
// camada (.claude/arquitetura-backend-ddd-lite.md). `MacroEventResult`
// (admin/application/ports/macroEventTrigger) satisfaz essa forma
// estruturalmente, é só quem chama de fato.
export interface RedactablePendingEvent {
  status: string
  direction: string
  magnitude_band: string
  price_effect_pct?: number
  fundamentals_effect_pct?: number
  targets: unknown[]
}

// RF16 (tela 5.1, tarefa 6.6.3) — NewsEventList (frontend) só *deixa de
// renderizar* direction/magnitude_band/efeitos/alvos enquanto
// `status = pendente`; isso não impede leitura direta de GET /news (rede,
// curl). Sem redigir aqui, a API devolveria o veredito do evento antes da
// hora, o que a tela inteira existe pra esconder.
export function redactPending<T extends RedactablePendingEvent>(events: T[]): T[] {
  return events.map((event) => {
    if (event.status === 'aplicado') return event
    // Cast controlado: o objeto devolvido continua satisfazendo
    // RedactablePendingEvent (o contrato que este módulo enxerga) — T pode
    // ser um tipo mais específico do chamador (ex.: MacroEventResult), que
    // o TypeScript não consegue provar automaticamente aqui dentro de uma
    // função genérica.
    return {
      ...event,
      direction: '',
      magnitude_band: '',
      price_effect_pct: undefined,
      fundamentals_effect_pct: undefined,
      targets: [],
    } as T
  })
}
