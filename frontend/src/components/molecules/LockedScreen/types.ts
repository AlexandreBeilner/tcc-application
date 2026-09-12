export interface LockedScreenProps {
    // Mesmo shape de `LockedAssetPanel` (`findLessonUnlocking` devolve
    // `{ id, code, title, reachable }`) — os 3 primeiros ausentes quando
    // nenhuma lição seedada ainda cobre a chave; `reachable` (tarefa N.3)
    // segue o mesmo default de `LockedAssetPanel` quando omitido.
    lessonId?: string
    lessonCode?: string
    reachable?: boolean
}
