export interface LevelProgress {
    currentLevelXp: number
    nextLevelXp: number
    progressRatio: number
}

// Espelha a curva de `backend/src/modules/gamification/domain/progression.ts`
// (`xpRequiredForLevel`) — duplicada de propósito: fronteira de serviço,
// sem pacote Node compartilhado entre backend e frontend. Se a curva do
// backend mudar (ela é "ilustrativa, sujeita à calibração da tarefa 8.1"),
// este arquivo precisa mudar junto, ou o anel de XP passa a mentir.
function xpRequiredForLevel(level: number): number {
    return (100 * (level - 1) * level) / 2
}

// Usado pro anel de progresso do avatar (identidade-visual-padroes.md) —
// nunca fabrica dado: só deriva do `xp`/`level` reais de `GET /me/progression`.
export function computeLevelProgress(xp: number, level: number): LevelProgress {
    const currentLevelXp = xpRequiredForLevel(level)
    const nextLevelXp = xpRequiredForLevel(level + 1)
    const span = nextLevelXp - currentLevelXp
    const progressRatio = span > 0 ? Math.min(1, Math.max(0, (xp - currentLevelXp) / span)) : 1

    return { currentLevelXp, nextLevelXp, progressRatio }
}
