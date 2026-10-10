// Correção manual de conquista pelo painel (N.17).
export class AchievementNotFoundError extends Error {}
export class AchievementAlreadyUnlockedError extends Error {}
// Cadastro de conquista pelo painel (N.19): dado que a regra de domínio recusa (nome ou meta
// inválidos, critério fora da lista fechada) e nome já usado por outra conquista.
export class InvalidAchievementError extends Error {}
export class AchievementNameTakenError extends Error {}
