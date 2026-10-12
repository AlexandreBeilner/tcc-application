import type { HoldingsSnapshotProvider } from '../../application/ports/holdingsSnapshotProvider'
import type { HoldingsSnapshot } from '../../domain/assembly'
import { engineJson } from './engineClient'

// Espelha `POST/GET /governance/snapshots` (`.docs/engine/governance.md`).
interface SnapshotResponse {
  taken_at: string
  holdings: Array<{ user_id: string; quantity: number }>
}

function toSnapshot(res: SnapshotResponse): HoldingsSnapshot {
  return {
    takenAt: new Date(res.taken_at),
    holdings: res.holdings.map((h) => ({ userId: h.user_id, quantity: h.quantity })),
  }
}

export function createEngineHoldingsSnapshotProvider(engineUrl: string): HoldingsSnapshotProvider {
  return {
    async take(assembly) {
      return toSnapshot(
        await engineJson<SnapshotResponse>(`${engineUrl}/governance/snapshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assembly_id: assembly.id, company_id: assembly.subjectRef }),
        }),
      )
    },
    async get(assembly) {
      return toSnapshot(
        await engineJson<SnapshotResponse>(`${engineUrl}/governance/snapshots/${assembly.id}`),
      )
    },
  }
}
