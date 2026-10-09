export type LockedGateVariant = 'screen' | 'section' | 'inline'

export interface LockedGateProps {
    // Tamanho, ícone e composição vêm da variante, nunca do contêiner (RC.2.5):
    // `screen` = rota inteira (Portfólio/Calculadora/Notícias), `section` =
    // página de detalhe travada (Ativo/Renda Fixa), `inline` = dentro de
    // diálogo/linha.
    variant: LockedGateVariant
    // Id da lição que desbloqueia — ausente quando nenhuma lição seedada
    // cobre a chave ou quando a origem é só `{ code, title }` (403 sem `id`,
    // `.docs/backend/market.md`).
    lessonId?: string
    // Título da lição, nunca o código ("Lição X.X" não pode aparecer em
    // texto de UI fora do Mapa da Trilha, decisão do autor, 2026-09-12).
    lessonTitle?: string
    // `LessonUnlockHint.reachable` (N.1): só `false` explícito força o CTA
    // pro Mapa da Trilha mesmo com `lessonId` presente (N.2).
    reachable?: boolean
}
