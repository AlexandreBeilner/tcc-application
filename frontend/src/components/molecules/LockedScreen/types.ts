export interface LockedScreenProps {
    // Mesmo shape de `LockedAssetPanel` (`findLessonUnlocking` devolve
    // `{ id, code, title }`) — ambos ausentes quando nenhuma lição seedada
    // ainda cobre a chave.
    lessonId?: string
    lessonCode?: string
}
