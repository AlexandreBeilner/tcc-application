import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
import type { MaterializeUpcomingPuzzlesUseCase } from '../../application/useCases/materializeUpcomingPuzzles'

// Agendamento do job da agenda do Diário (DI.1.3), no formato do `payrollScheduler`: roda já na
// subida e depois a cada `intervalMs`; falha isolada é logada, nunca derruba o processo. A cadência
// pode ser larga: a agenda trabalha com 30 dias de folga.
export function startDailyAgendaScheduler(
  materialize: MaterializeUpcomingPuzzlesUseCase,
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('daily-agenda', intervalMs)
  const attempt = async () => {
    try {
      const result = await materialize.execute()
      if (result.created.length > 0 || result.removed > 0 || result.renumbered > 0) {
        console.log(
          `diário: agenda com ${result.created.length} jogo(s) novo(s), ${result.renumbered} renumerado(s), ${result.removed} descartado(s)`,
        )
      }
      for (const warning of result.warnings) {
        console.warn(`diário: aviso na agenda de ${warning.date}: ${warning.code}`)
      }
      recordJobSuccess('daily-agenda')
    } catch (err) {
      recordJobFailure('daily-agenda')
      console.error('diário: erro ao materializar a agenda', err)
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
