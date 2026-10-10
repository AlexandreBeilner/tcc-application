import type { MonthKey, RetrospectiveData } from '../../domain/retrospective'

export interface RetrospectiveRepository {
  find(userId: string, month: MonthKey): Promise<RetrospectiveData | null>
  // Grava uma vez; se já existe (corrida entre job e leitura), mantém a primeira e a devolve.
  saveIfAbsent(userId: string, month: MonthKey, data: RetrospectiveData): Promise<RetrospectiveData>
  // Quem já tem retrospectiva desse mês, para o job pular.
  listUserIdsWith(month: MonthKey): Promise<Set<string>>
}
