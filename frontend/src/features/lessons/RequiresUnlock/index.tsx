import { Outlet } from 'react-router-dom'
import { LockedGate } from '../../../components/organisms/LockedGate'
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
// normais, só o conteúdo (o que seria o `Outlet`) vira `LockedGate`. Só
// reflexo de UX — a garantia real (403) é o backend, ver
// `.docs/backend/market.md`. `isError` (revisão da Semana 7) segura o mesmo
// caminho de `isLoading`: uma falha transitória de `GET /lessons` não pode
// travar quem já desbloqueou a chave. `reachable` repassado pra
// `LockedGate` (tarefa N.3, consistência preventiva com N.2). Desde a
// Fase Q também protege `/noticias` (`unlockKey="news_feed"`) — reversão da
// decisão original de tratar notícia como conteúdo "sempre acessível, só
// aviso": o autor decidiu que bloqueio é parede em todo lugar macro da
// aplicação, sem exceção por classe de risco do conteúdo.
export function RequiresUnlock({ unlockKey }: RequiresUnlockProps) {
    const { unlockedKeys, lessons, isLoading, isError } = useUnlockedKeys()

    if (isLoading || isError) {
        return null
    }

    if (!unlockedKeys.has(unlockKey)) {
        const hint = findLessonUnlocking(unlockKey, lessons)
        return <LockedGate variant="screen" lessonId={hint?.id} lessonTitle={hint?.title} reachable={hint?.reachable} />
    }

    return <Outlet />
}
