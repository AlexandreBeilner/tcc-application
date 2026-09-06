import { Navigate, Outlet } from 'react-router-dom'
import { useUnlockedKeys } from '../useUnlockedKeys'
import type { RequiresUnlockProps } from './types'

export type { RequiresUnlockProps } from './types'

// Gate de navegação real (tarefa 7.0.1, achado 5) — mesmo padrão de
// `features/auth/ProtectedRoute` (`<ProtectedRoute requireRole="admin">`,
// tarefa 6.2): rota sem a chave desbloqueada redireciona pra `/trilha` em
// vez de deixar o usuário cair numa tela vazia/sem sentido (ex: Portfólio
// antes de 0.1). Só reflexo de UX — a garantia real (403) é o backend, ver
// `.docs/backend/market.md`.
export function RequiresUnlock({ unlockKey }: RequiresUnlockProps) {
    const { unlockedKeys, isLoading } = useUnlockedKeys()

    if (isLoading) {
        return null
    }

    if (!unlockedKeys.has(unlockKey)) {
        return <Navigate to="/trilha" replace />
    }

    return <Outlet />
}
