export interface LockedScreenProps {
    // Mesmo shape de `LockedAssetPanel` (`findLessonUnlocking` devolve
    // `{ id, code, title, reachable }`, mas o `code` nunca chega até a UI —
    // Fase Q) — os 2 primeiros ausentes quando nenhuma lição seedada ainda
    // cobre a chave; `reachable` segue o mesmo default de `LockedAssetPanel`
    // quando omitido.
    lessonId?: string
    lessonTitle?: string
    reachable?: boolean
}
