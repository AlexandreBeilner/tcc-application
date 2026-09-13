import { LockedAssetPanel } from '../LockedAssetPanel'
import type { LockedScreenProps } from './types'
import styles from './index.module.css'

export type { LockedScreenProps } from './types'

// Substitui o `<Outlet/>` de `RequiresUnlock` (tarefa K.2) quando a rota
// inteira (Portfólio/Calculadora) está travada pela trilha — mesmo discurso
// "prévia, não parede" que `LockedAssetPanel` já usa dentro do Detalhe de
// Ativo (J.3), reaproveitado aqui em vez de reimplementado, só centralizado
// numa tela cheia (o `TopBar`/`TabBar` do `AppShell` continuam normais por
// fora, isto aqui só substitui o conteúdo da rota).
export function LockedScreen({ lessonId, lessonTitle, reachable }: LockedScreenProps) {
    return (
        <main className={styles.page}>
            <LockedAssetPanel lessonId={lessonId} lessonTitle={lessonTitle} reachable={reachable} />
        </main>
    )
}
