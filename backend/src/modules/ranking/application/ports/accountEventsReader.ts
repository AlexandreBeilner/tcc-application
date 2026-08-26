import type { MarketEventRecord } from '../../domain/networth'

// Lê o extrato completo de `market_events` de um usuário — vive no banco
// "market", dono é o motor, nunca lido direto por aqui (mesmo raciocínio de
// `MacroEventReader`). Pagina até esgotar `GET /accounts/:user_id/events`
// (4.7); volume de eventos por usuário num protótipo de TCC não justifica
// otimização maior (mesmo padrão de aceitação de escala documentado em
// `.docs/engine/orders.md`).
export interface AccountEventsReader {
  listAllEvents(userId: string): Promise<MarketEventRecord[]>
}
