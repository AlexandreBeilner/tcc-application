export class MissionNotFoundError extends Error {}
export class LessonNotCompletedTodayError extends Error {}
export class OldLessonNotReviewedTodayError extends Error {}
export class MicroDecisionStreakNotReachedError extends Error {}
export class DailyNotCompletedTodayError extends Error {}
// Edição de missão pelo painel (N.19): título, descrição ou XP que a regra de domínio recusa.
export class InvalidMissionError extends Error {}
