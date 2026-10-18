import type { GetDailyQualityUseCase } from '../../../daily/application/useCases/getDailyQuality'
import type { GetProgressionUseCase } from '../../../gamification/application/useCases/getProgression'
import type { CountCompletedLessonsUseCase } from '../../../lessons/application/useCases/countCompletedLessons'
import type { GetCurrentMicroDecisionStreakUseCase } from '../../../lessons/application/useCases/getCurrentMicroDecisionStreak'
import type { GetTracksCompletedWithoutErrorsCountUseCase } from '../../../lessons/application/useCases/getTracksCompletedWithoutErrorsCount'
import type { CountReviewedLessonsUseCase } from '../../../lessons/application/useCases/countReviewedLessons'
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
// nunca desbloqueariam. Os 3 campos de qualidade (H.1) são mais 3 leituras
// de `lessons`, cada uma sua própria porta-por-consumidor — mesmo padrão de
// `countCompletedLessons`, nenhuma reaproveita a outra.
export function createInProcessProgressSnapshotReader(deps: {
  getProgression: GetProgressionUseCase
  countCompletedLessons: CountCompletedLessonsUseCase
  getCurrentMicroDecisionStreak: GetCurrentMicroDecisionStreakUseCase
  getTracksCompletedWithoutErrorsCount: GetTracksCompletedWithoutErrorsCountUseCase
  countReviewedLessons: CountReviewedLessonsUseCase
  // Assembleias distintas em que a pessoa votou (MO.6.7); 0 com o recurso desligado.
  countAssembliesParticipated: { count(userId: string): Promise<number> }
  // Indicações válidas (MO.7.2).
  countReferralsQualified: { count(userId: string): Promise<number> }
  // Qualidade no Diário (DI.6.1), já restrita a jogo concluído no próprio dia.
  getDailyQuality: GetDailyQualityUseCase
  getNetWorth: NetWorthReader
  sandboxAssetReader: SandboxAssetReader
}): ProgressSnapshotReader {
  return {
    async getSnapshot(userId) {
      const [
        progression,
        lessonsCompleted,
        microDecisionsStreak,
        tracksCompletedNoErrors,
        lessonsReviewed,
        assembliesParticipated,
        referralsQualified,
        dailyQuality,
        sandboxAssetIds,
      ] = await Promise.all([
        deps.getProgression.execute({ userId }),
        deps.countCompletedLessons.execute({ userId }),
        deps.getCurrentMicroDecisionStreak.execute({ userId }),
        deps.getTracksCompletedWithoutErrorsCount.execute({ userId }),
        deps.countReviewedLessons.execute({ userId }),
        deps.countAssembliesParticipated.count(userId),
        deps.countReferralsQualified.count(userId),
        deps.getDailyQuality.execute({ userId }),
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
        microDecisionsStreak,
        tracksCompletedNoErrors,
        lessonsReviewed,
        assembliesParticipated,
        referralsQualified,
        dailyWordFirstTry: dailyQuality.wordFirstTryGames,
        dailyPerfectDays: dailyQuality.perfectDays,
        dailyTimelineStreak: dailyQuality.bestTimelineRun,
      }
    },
  }
}
