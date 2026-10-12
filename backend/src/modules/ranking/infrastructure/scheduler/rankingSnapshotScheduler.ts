import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
import type { ComputeRankingSnapshotUseCase } from '../../application/useCases/computeRankingSnapshot'

// Agendamento do job do ranking: infra de tempo, nunca a regra em si (isso é
// `ComputeRankingSnapshotUseCase`). Mesmo espírito de `startPayrollScheduler`: roda uma vez já
// na subida (a tela não fica sem ranking até a primeira janela) e depois a cada `intervalMs`.
// Uma execução ainda em andamento nunca é sobreposta por outra, e uma falha isolada é logada
// sem derrubar o processo.
export function startRankingSnapshotScheduler(
  computeSnapshot: ComputeRankingSnapshotUseCase,
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('ranking', intervalMs)
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const result = await computeSnapshot.execute()
      console.log(
        `ranking: snapshot calculado (${result.users} usuário(s), ${result.groups} grupo(s))`,
      )
      recordJobSuccess('ranking')
    } catch (err) {
      recordJobFailure('ranking')
      console.error('ranking: erro ao calcular o snapshot', err)
    } finally {
      running = false
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
