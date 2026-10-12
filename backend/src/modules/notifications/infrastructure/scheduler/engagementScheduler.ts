import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
// Agendamento dos jobs de e-mail de engajamento: infra de tempo, nunca a regra (a janela do dia,
// a idempotência e a audiência são dos casos de uso). Cada job é checado a cada `intervalMs`
// (minutos, não segundos: ninguém espera o resumo semanal no minuto exato); o caso de uso decide
// se está na janela e a chave de idempotência impede repetir. Um ciclo ainda em andamento nunca é
// sobreposto, e uma falha de um job não derruba o processo nem os outros.
export interface EngagementJob {
  name: string
  execute(): Promise<unknown>
}

export function startEngagementScheduler(
  jobs: EngagementJob[],
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('email-engagement', intervalMs)
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    let allOk = true
    for (const job of jobs) {
      try {
        const result = (await job.execute()) as { enqueued?: number }
        if (result.enqueued) console.log(`e-mail: ${job.name}, ${result.enqueued} enfileirado(s)`)
      } catch (err) {
        allOk = false
        console.error(`e-mail: erro no job ${job.name}`, err)
      }
    }
    if (allOk) recordJobSuccess('email-engagement')
    else recordJobFailure('email-engagement')
    running = false
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
