import { dailyDay } from '../../domain/gameDay'
import { metricForEvent, type MetricEvent } from '../../domain/metrics'
import type { DailyMetricsRepository } from '../ports/dailyMetricsRepository'

// Soma 1 ao contador do dia UTC em que o aviso chegou. Não recebe nem guarda nada de quem avisou
// (sem usuário, IP ou número de jogo): só o evento e o relógio do servidor.
export class RecordDailyMetricUseCase {
  constructor(private readonly metrics: DailyMetricsRepository) {}

  async execute(input: { event: MetricEvent; now: Date }): Promise<void> {
    await this.metrics.increment(dailyDay(input.now), metricForEvent(input.event))
  }
}
