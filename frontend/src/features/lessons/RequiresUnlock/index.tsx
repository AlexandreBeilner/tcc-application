import { Outlet } from 'react-router-dom'
import { LockedScreen } from '../../../components/molecules/LockedScreen'
import { findLessonUnlocking } from '../unlockedKeys'
import { useUnlockedKeys } from '../useUnlockedKeys'
import type { RequiresUnlockProps } from './types'

export type { RequiresUnlockProps } from './types'

// Gate de navegação real (tarefa 7.0.1, achado 5) — mesmo padrão de
// `features/auth/ProtectedRoute` (`<ProtectedRoute requireRole="admin">`,
// tarefa 6.2). Até a tarefa K.2, rota sem a chave desbloqueada redirecionava
// pra `/trilha` com `<Navigate>`, sem nenhuma explicação — exatamente o beco
// sem saída que a J.1 já tinha corrigido na `TabBar`, só que nunca estendido
// pra este gate (achado de auditoria, sessão 2026-09-12, mais visível no
// mobile: era a primeira coisa que um usuário novo encontrava). Agora a
// própria rota renderiza — `TopBar`/`TabBar` do `AppShell` continuam
// normais, só o conteúdo (o que seria o `Outlet`) vira `LockedScreen`, mesmo
// discurso "prévia, não parede" da J.3 aplicado à tela inteira. Só reflexo
// de UX — a garantia real (403) é o backend, ver `.docs/backend/market.md`.
// `isError` (revisão da Semana 7) segura o mesmo caminho de `isLoading`: uma
// falha transitória de `GET /lessons` não pode travar quem já desbloqueou a
// chave. `reachable` repassado pra `LockedScreen` (tarefa N.3, consistência
// preventiva com N.2) — hoje sempre `true` pras 2 chaves reais deste gate
// (`portfolio`/`calculator`, desbloqueiam nas 2 primeiras lições).
export function RequiresUnlock({ unlockKey }: RequiresUnlockProps) {
    const { unlockedKeys, lessons, isLoading, isError } = useUnlockedKeys()

    if (isLoading || isError) {
        return null
    }

    if (!unlockedKeys.has(unlockKey)) {
        const hint = findLessonUnlocking(unlockKey, lessons)
        return <LockedScreen lessonId={hint?.id} lessonCode={hint?.code} reachable={hint?.reachable} />
    }

    return <Outlet />
}
