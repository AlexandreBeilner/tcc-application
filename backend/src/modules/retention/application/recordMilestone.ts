import type { Milestone } from '../domain/milestones'
import type { MilestoneRepository } from './ports/milestoneRepository'

// Grava um marco pelo caso de uso dono do fato. Best-effort: um marco perdido só afeta o painel
// de retenção, nunca pode desfazer uma lição concluída nem uma ordem já executada.
export class RecordMilestoneUseCase {
  constructor(
    private readonly milestones: MilestoneRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, milestone: Milestone): Promise<void> {
    try {
      await this.milestones.recordIfAbsent(userId, milestone, this.clock())
    } catch (err) {
      console.error(`[retention] falha ao registrar o marco ${milestone}`, err)
    }
  }
}
