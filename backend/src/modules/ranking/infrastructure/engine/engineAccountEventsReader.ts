import type { AccountEventsReader } from '../../application/ports/accountEventsReader'
import type { MarketEventRecord, MarketEventType } from '../../domain/networth'

interface EngineEventResponse {
  id: string
  event_type: MarketEventType
  asset_id?: string
  quantity?: number
  unit_value?: number
  timestamp: string
}

// Máximo aceito por `GET /accounts/:user_id/events` (4.7) — pagina até uma
// página vir mais curta que isso.
const PAGE_SIZE = 100

export function createEngineAccountEventsReader(engineUrl: string): AccountEventsReader {
  return {
    async listAllEvents(userId: string): Promise<MarketEventRecord[]> {
      const events: MarketEventRecord[] = []
      let offset = 0

      for (;;) {
        const res = await fetch(
          `${engineUrl}/accounts/${userId}/events?limit=${PAGE_SIZE}&offset=${offset}`,
        )
        if (!res.ok) {
          throw new Error(
            `falha ao ler extrato do usuário no motor de simulação (status ${res.status})`,
          )
        }

        const page = (await res.json()) as EngineEventResponse[]
        for (const raw of page) {
          events.push({
            id: raw.id,
            eventType: raw.event_type,
            assetId: raw.asset_id,
            quantity: raw.quantity,
            unitValue: raw.unit_value,
            timestamp: new Date(raw.timestamp),
          })
        }

        if (page.length < PAGE_SIZE) {
          break
        }
        offset += PAGE_SIZE
      }

      return events
    },
  }
}
