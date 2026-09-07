export interface LockedAssetPanelProps {
    // Code/id da lição que desbloqueia o produto — ambos ausentes quando
    // nenhuma lição seedada ainda cobre a chave (currículo incompleto até a
    // tarefa 7.1) ou quando a origem é só `{ code, title }` sem `id`
    // (`ProductLockedError`, `.docs/backend/market.md` — o 403 não traz
    // `id`, só o Detalhe já carregado sabe o `id` via `unlockingLessonFor`).
    lessonId?: string
    lessonCode?: string
}
