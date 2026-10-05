import { InvalidMissionError } from './errors'
import {
  MICRO_DECISION_STREAK_MISSION_KEY,
  REVIEW_OLD_LESSON_MISSION_KEY,
  type Mission,
} from './mission'

// Como a conclusão da missão é conferida (N.19, "tipo" da missão no painel). É código, não
// dado: por isso o painel não cria missão nova (uma sem verificação seria XP de graça) e
// não edita o tipo.
export type MissionVerification = 'lesson_completion' | 'server_check' | 'client_reported'

export function missionVerification(
  mission: Pick<Mission, 'key' | 'requiresLessonCompletion'>,
): MissionVerification {
  if (mission.requiresLessonCompletion) return 'lesson_completion'
  if (
    mission.key === REVIEW_OLD_LESSON_MISSION_KEY ||
    mission.key === MICRO_DECISION_STREAK_MISSION_KEY
  ) {
    return 'server_check'
  }
  return 'client_reported'
}

export const MAX_MISSION_TITLE_LENGTH = 150
export const MAX_MISSION_DESCRIPTION_LENGTH = 500
export const MIN_MISSION_XP_REWARD = 1
// Teto de digitação: uma lição vale 50 e uma missão 30 hoje. 500 deixa folga pra calibrar
// sem deixar um zero a mais virar centenas de níveis.
export const MAX_MISSION_XP_REWARD = 500

export interface MissionPatch {
  title?: string
  description?: string | null
  xpReward?: number
  isActive?: boolean
}

// Valida e normaliza a edição do painel: só texto, XP e liga/desliga. Campo ausente fica fora
// do resultado (não é "apagar"); descrição vazia vira null.
export function validateMissionPatch(patch: MissionPatch): MissionPatch {
  const result: MissionPatch = {}
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (title.length === 0 || title.length > MAX_MISSION_TITLE_LENGTH) {
      throw new InvalidMissionError(
        `o título precisa ter de 1 a ${MAX_MISSION_TITLE_LENGTH} caracteres`,
      )
    }
    result.title = title
  }
  if (patch.description !== undefined) {
    const description = patch.description?.trim() || null
    if (description !== null && description.length > MAX_MISSION_DESCRIPTION_LENGTH) {
      throw new InvalidMissionError(
        `a descrição pode ter no máximo ${MAX_MISSION_DESCRIPTION_LENGTH} caracteres`,
      )
    }
    result.description = description
  }
  if (patch.xpReward !== undefined) {
    if (
      !Number.isInteger(patch.xpReward) ||
      patch.xpReward < MIN_MISSION_XP_REWARD ||
      patch.xpReward > MAX_MISSION_XP_REWARD
    ) {
      throw new InvalidMissionError(
        `o XP precisa ser um inteiro de ${MIN_MISSION_XP_REWARD} a ${MAX_MISSION_XP_REWARD}`,
      )
    }
    result.xpReward = patch.xpReward
  }
  if (patch.isActive !== undefined) result.isActive = patch.isActive
  return result
}
