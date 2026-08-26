import type { GetProgressionUseCase } from '../../../gamification/application/useCases/getProgression'
import type { CountCompletedLessonsUseCase } from '../../../lessons/application/useCases/countCompletedLessons'
import type { NetWorthReader } from '../../../ranking/application/useCases/getNetWorth'
import type { SandboxAssetReader } from '../../../ranking/application/ports/sandboxAssetReader'
import type { ProgressSnapshotReader } from '../../application/ports/progressSnapshotReader'

// Único adapter que agrega os 3 módulos que `ProgressSnapshotReader` promete
// — cada chamada em processo, sem HTTP. `netWorth`/`tradesExecuted` passam
// `asOf: new Date()` (nunca `undefined`) de propósito: o caminho "agora" de
// `GetNetWorthUseCase` (comentário em getNetWorth.ts, deixado pela 5.5 já
// prevendo este consumidor) usa `CurrentAccountStateReader`, que não conta
// operações — só o caminho de replay (forçado por um `asOf` explícito)
// preenche `tradesExecuted`. Sem isso, "Primeira Operação"/"Trader Ativo"
// nunca desbloqueariam.
export function createInProcessProgressSnapshotReader(deps: {
  getProgression: GetProgressionUseCase
  countCompletedLessons: CountCompletedLessonsUseCase
  getNetWorth: NetWorthReader
  sandboxAssetReader: SandboxAssetReader
}): ProgressSnapshotReader {
  return {
    async getSnapshot(userId) {
      const [progression, lessonsCompleted, sandboxAssetIds] = await Promise.all([
        deps.getProgression.execute({ userId }),
        deps.countCompletedLessons.execute({ userId }),
        deps.sandboxAssetReader.listSandboxAssetIds(),
      ])

      const netWorthSnapshot = await deps.getNetWorth.execute({
        userId,
        asOf: new Date(),
        sandboxAssetIds,
      })

      return {
        netWorth: netWorthSnapshot.total,
        streakDays: progression.currentStreak,
        lessonsCompleted,
        tradesExecuted: netWorthSnapshot.tradesExecuted,
      }
    },
  }
}
