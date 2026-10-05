import { missionVerification, validateMissionPatch, type MissionPatch } from '../../domain/catalog'
import { MissionNotFoundError } from '../../domain/errors'
import { todayUtc, type Mission } from '../../domain/mission'
import type { MissionRepository } from '../ports/missionRepository'
import type { MissionVerification } from '../../domain/catalog'

// Missão do catálogo com o que o painel mostra a mais: como a conclusão é conferida e
// quantos usuários concluíram (no total e hoje).
export interface MissionCatalogEntry extends Mission {
  verification: MissionVerification
  completedUsers: number
  completedToday: number
}

export class ListMissionCatalogUseCase {
  constructor(
    private readonly missionRepository: MissionRepository,
    private readonly today: () => string = () => todayUtc(new Date()),
  ) {}

  async execute(): Promise<MissionCatalogEntry[]> {
    const [catalog, counts] = await Promise.all([
      this.missionRepository.listAll(),
      this.missionRepository.countCompletions(this.today()),
    ])
    return catalog.map((mission) => ({
      ...mission,
      verification: missionVerification(mission),
      completedUsers: counts.get(mission.id)?.users ?? 0,
      completedToday: counts.get(mission.id)?.today ?? 0,
    }))
  }
}

// Edita título, descrição, XP e o liga/desliga de uma missão (N.19). Missão desativada deixa
// de ser gerada pro dia (e some da lista do jogador); nunca apaga o progresso já gravado, nem
// tira XP de quem concluiu. O tipo (como a conclusão é conferida) é código e não se edita.
export class UpdateMissionUseCase {
  constructor(private readonly missionRepository: MissionRepository) {}

  async execute(id: string, patch: MissionPatch): Promise<Mission> {
    const validated = validateMissionPatch(patch)
    const updated = await this.missionRepository.update(id, validated)
    if (!updated) throw new MissionNotFoundError('missão não encontrada')
    return updated
  }
}
