export interface LockedAssetPanelProps {
    // Id da lição que desbloqueia o produto — ausente quando nenhuma lição
    // seedada ainda cobre a chave (currículo incompleto) ou quando a origem
    // é só `{ code, title }` sem `id` (`ProductLockedError`,
    // `.docs/backend/market.md` — o 403 não traz `id`, só o Detalhe já
    // carregado sabe o `id` via `unlockingLessonFor`).
    lessonId?: string
    // Título da lição (nunca o código: decisão do autor, Fase Q — "Lição
    // X.X" não pode aparecer em nenhum texto de UI fora do Mapa da Trilha).
    lessonTitle?: string
    // `LessonUnlockHint.reachable` (tarefa N.1) — omitido (`undefined`) é
    // tratado como alcançável, preservando o comportamento de hoje pros
    // chamadores que ainda não sabem responder essa pergunta
    // (`OrderConfirmationDialog`, que só tem `code`/`title` do 403, e
    // `LockedScreen`, coberto pela N.3). Só `false` explícito força o CTA
    // pro Mapa da Trilha mesmo com `lessonId` presente (tarefa N.2).
    reachable?: boolean
}
