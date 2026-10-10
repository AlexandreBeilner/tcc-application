import type { GenerateMonthlyRetrospectivesUseCase } from '../../application/useCases/generateMonthlyRetrospectives'

// Agendamento do job mensal da retrospectiva: infra de tempo, nunca a regra. Roda uma vez na
// subida (recupera o que ficou para trás com o processo parado) e depois a cada `intervalMs`
// (a regra é idempotente e pula quem já tem, então checar de hora em hora é barato).
export function startRetrospectiveScheduler(
  job: Pick<GenerateMonthlyRetrospectivesUseCase, 'execute'>,
  intervalMs: number,
): NodeJS.Timeout {
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const result = await job.execute()
      if (result.generated + result.failed > 0) {
        console.log(
          `retrospectivas ${result.month}: ${result.generated} gerada(s), ${result.skipped} já existente(s), ${result.failed} falha(s)`,
        )
      }
    } catch (err) {
      console.error('retrospectivas: erro ao gerar as retrospectivas do mês', err)
    } finally {
      running = false
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
