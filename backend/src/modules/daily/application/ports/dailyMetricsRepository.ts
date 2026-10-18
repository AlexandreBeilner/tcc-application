import type { StoredMetric } from '../../domain/metrics'

export interface DailyMetricRow {
  date: string
  metric: StoredMetric
  count: number
}

export interface LoggedGamesRow {
  date: string
  started: number
  completed: number
}

export interface DailyMetricsRepository {
  // Soma 1 ao contador do dia (cria a linha se não existe), atômico entre requisições.
  increment(day: string, metric: StoredMetric): Promise<void>
  // Contadores gravados no intervalo (dias UTC, inclusive).
  listStored(from: string, to: string): Promise<DailyMetricRow[]>
  // Jogos de quem tem conta, lidos de `daily_results`: iniciados pelo dia UTC de `started_at` e
  // concluídos pelo de `completed_at`. Só dias com algum jogo.
  listLoggedGames(from: string, to: string): Promise<LoggedGamesRow[]>
}
