import type { DailyGameLoader } from '../dailyGameLoader'
import { toPublicGame, type PublicGame } from '../publicGame'

// `GET /daily/:number`: o jogo de hoje ou de um dia anterior, sem gabarito. Número futuro responde
// como inexistente (seção 3.6).
export class GetGameUseCase {
  constructor(private readonly loader: DailyGameLoader) {}

  async execute(input: { number: number; now: Date }): Promise<PublicGame> {
    return toPublicGame(await this.loader.load(input.number, input.now), input.now)
  }
}
