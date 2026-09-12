export interface LockedAssetPanelProps {
    // Code/id da lição que desbloqueia o produto — ambos ausentes quando
    // nenhuma lição seedada ainda cobre a chave (currículo incompleto até a
    // tarefa 7.1) ou quando a origem é só `{ code, title }` sem `id`
    // (`ProductLockedError`, `.docs/backend/market.md` — o 403 não traz
    // `id`, só o Detalhe já carregado sabe o `id` via `unlockingLessonFor`).
    lessonId?: string
    lessonCode?: string
    // `LessonUnlockHint.reachable` (tarefa N.1) — omitido (`undefined`) é
    // tratado como alcançável, preservando o comportamento de hoje pros
    // chamadores que ainda não sabem responder essa pergunta
    // (`OrderConfirmationDialog`, que só tem `code`/`title` do 403, e
    // `LockedScreen`, coberto pela N.3). Só `false` explícito força o CTA
    // pro Mapa da Trilha mesmo com `lessonId` presente (tarefa N.2).
    reachable?: boolean
}
