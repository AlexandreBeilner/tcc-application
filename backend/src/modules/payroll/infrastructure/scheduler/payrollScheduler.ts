import type { RunPayrollCheckUseCase } from '../../application/useCases/runPayrollCheck'

// Agendamento em tempo real do job de folha de pagamento (T.5) — infra de
// tempo (timer), nunca a regra de negócio em si (isso é
// `RunPayrollCheckUseCase`). Mesmo espírito de `scheduler.Run` do
// Temporizador do motor (S.3): roda uma vez já na subida (cobre o caso do
// backend ter ficado fora do ar durante a janela de pagamento) e depois a
// cada `intervalMs`; uma falha isolada é logada, nunca derruba o processo.
// A cadência real (5º dia útil do MÊS) tolera um intervalo de checagem bem
// mais largo que o tick do motor — não precisa ser por segundo.
export function startPayrollScheduler(
  runPayrollCheck: RunPayrollCheckUseCase,
  intervalMs: number,
): NodeJS.Timeout {
  const attempt = async () => {
    try {
      const result = await runPayrollCheck.execute()
      if (result.usersPaid > 0) {
        console.log(
          `folha de pagamento: ${result.usersPaid}/${result.usersChecked} usuário(s) creditado(s), ${result.monthsPaidTotal} mês(es) pago(s)`,
        )
      }
    } catch (err) {
      console.error('folha de pagamento: erro no check periódico', err)
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
