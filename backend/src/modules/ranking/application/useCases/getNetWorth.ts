import { replay, type Snapshot } from '../../domain/networth'
import type { AccountEventsReader } from '../ports/accountEventsReader'
import type { AssetPriceHistoryReader } from '../ports/assetPriceHistoryReader'
import type { CurrentAccountStateReader } from '../ports/currentAccountStateReader'

export interface GetNetWorthInput {
  userId: string
  // Omitido = "agora" (usa o estado já projetado, mais barato). Presente =
  // reconstrói por replay até esse instante.
  asOf?: Date
  sandboxAssetIds: Set<string>
}

// Interface pequena (não a classe concreta) — é o que `GetRankingUseCase`
// depende, pra poder ser testado com um fake sem precisar instanciar os
// três readers concretos que `GetNetWorthUseCase` usa por baixo.
export interface NetWorthReader {
  execute(input: GetNetWorthInput): Promise<Snapshot>
}

export class GetNetWorthUseCase implements NetWorthReader {
  constructor(
    private readonly accountEventsReader: AccountEventsReader,
    private readonly assetPriceHistoryReader: AssetPriceHistoryReader,
    private readonly currentAccountStateReader: CurrentAccountStateReader,
  ) {}

  async execute(input: GetNetWorthInput): Promise<Snapshot> {
    if (!input.asOf) {
      // Caminho rápido: `tradesExecuted` fica em 0 aqui (não é
      // recomputado por replay) — nenhum consumidor desta tarefa (5.5)
      // precisa dele pro lado "agora"; se um consumidor futuro (5.2,
      // "Trader Ativo") precisar de contagem cumulativa em tempo real,
      // vai precisar passar `asOf` explícito (mesmo que seja "agora") pra
      // forçar o caminho de replay.
      return this.currentAccountStateReader.getCurrentSnapshot(input.userId)
    }

    const allEvents = [...(await this.accountEventsReader.listAllEvents(input.userId))].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )

    // `asOf` pode, por uma diferença de poucos milissegundos entre o
    // relógio do banco `gamification` (users.created_at, usado pelo
    // GetRankingUseCase pro baseline de conta criada no meio da janela) e
    // o relógio do motor (o `initial_deposit` só é gravado depois do
    // round-trip HTTP de provisionamento), acabar sendo anterior até ao
    // primeiro evento do usuário — sem este clamp, a baseline ficaria
    // zerada em vez de refletir o capital inicial (RNF06), quebrando
    // "resultado consistente independente de quando o usuário entrou".
    const firstEventTimestamp = allEvents[0]?.timestamp
    const effectiveCutoff =
      firstEventTimestamp && firstEventTimestamp.getTime() > input.asOf.getTime()
        ? firstEventTimestamp
        : input.asOf
    const events = allEvents.filter((event) => event.timestamp.getTime() <= effectiveCutoff.getTime())

    const variableIncomeAssetIds = new Set<string>()
    for (const event of events) {
      if (
        (event.eventType === 'buy_order_executed' || event.eventType === 'sell_order_executed') &&
        event.assetId &&
        !input.sandboxAssetIds.has(event.assetId)
      ) {
        variableIncomeAssetIds.add(event.assetId)
      }
    }

    const quotesAsOf = new Map<string, number>()
    await Promise.all(
      [...variableIncomeAssetIds].map(async (assetId) => {
        quotesAsOf.set(
          assetId,
          await this.assetPriceHistoryReader.priceAsOf(assetId, effectiveCutoff),
        )
      }),
    )

    return replay(events, quotesAsOf, input.sandboxAssetIds)
  }
}
