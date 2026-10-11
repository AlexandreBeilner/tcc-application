import type { Achievement } from '../../domain/achievement'
import { isNameTaken, validateAchievementDraft, type AchievementDraft } from '../../domain/catalog'
import { AchievementNameTakenError, AchievementNotFoundError } from '../../domain/errors'
import type { AchievementPatch, AchievementRepository } from '../ports/achievementRepository'

// Conquista do catálogo com o que o painel mostra a mais: quantos usuários a ganharam.
export interface AchievementCatalogEntry extends Achievement {
  unlockedCount: number
}

// Catálogo completo (ativas e desativadas) com a contagem de quem ganhou cada uma (N.19).
export class ListAchievementCatalogUseCase {
  constructor(private readonly achievementRepository: AchievementRepository) {}

  async execute(): Promise<AchievementCatalogEntry[]> {
    const [catalog, counts] = await Promise.all([
      this.achievementRepository.listCatalog(),
      this.achievementRepository.countUnlockedByAchievement(),
    ])
    return catalog.map((achievement) => ({
      ...achievement,
      unlockedCount: counts.get(achievement.id) ?? 0,
    }))
  }
}

// Cria uma conquista pelo painel (N.19). Nasce ativa. O critério vem da lista fechada de
// regras que o código sabe avaliar (`ACHIEVEMENT_CRITERIA`), nunca de expressão livre.
export class CreateAchievementUseCase {
  constructor(private readonly achievementRepository: AchievementRepository) {}

  async execute(input: AchievementDraft): Promise<Achievement> {
    const draft = validateAchievementDraft(input)
    const catalog = await this.achievementRepository.listCatalog()
    if (isNameTaken(draft.name, catalog)) {
      throw new AchievementNameTakenError('já existe uma conquista com esse nome')
    }
    return this.achievementRepository.create(draft)
  }
}

// Edita nome, descrição, critério, meta e o liga/desliga (N.19). Desativar nunca remove o
// que o usuário já ganhou, e mudar a meta não revoga ninguém: só vale pra concessões futuras.
// Valida o estado final (campos novos sobre os atuais), então trocar só o tipo de critério
// de uma meta em reais por um de contagem é recusado se a meta não for inteira.
export class UpdateAchievementUseCase {
  constructor(private readonly achievementRepository: AchievementRepository) {}

  async execute(id: string, patch: AchievementPatch): Promise<Achievement> {
    const current = await this.achievementRepository.findById(id)
    if (!current) throw new AchievementNotFoundError('conquista não encontrada')

    const merged = validateAchievementDraft({
      name: patch.name ?? current.name,
      description: patch.description === undefined ? current.description : patch.description,
      criteriaType: patch.criteriaType ?? current.criteriaType,
      criteriaValue: patch.criteriaValue ?? current.criteriaValue,
    })
    if (patch.name !== undefined) {
      const catalog = await this.achievementRepository.listCatalog()
      if (isNameTaken(merged.name, catalog, id)) {
        throw new AchievementNameTakenError('já existe uma conquista com esse nome')
      }
    }

    const updated = await this.achievementRepository.update(id, {
      ...merged,
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.isRare !== undefined ? { isRare: patch.isRare } : {}),
    })
    if (!updated) throw new AchievementNotFoundError('conquista não encontrada')
    return updated
  }
}
