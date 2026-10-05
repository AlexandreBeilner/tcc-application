import type {
  AdminRanking,
  AdminRankingQuery,
  AdminRankingReader,
} from '../ports/adminRankingReader'

// Ranking global da janela corrente (semana ou mês) e top por página, só leitura (N.19). Não há
// "fechar janela": o ranking é calculado na hora sobre a janela fixa, sem estado gravado.
export class GetAdminRankingUseCase {
  constructor(private readonly rankingReader: AdminRankingReader) {}

  execute(query: AdminRankingQuery): Promise<AdminRanking> {
    return this.rankingReader.read(query)
  }
}
