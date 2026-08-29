import type { AuthUser } from '../../../services/auth'

export interface ProtectedRouteProps {
    // Usado pela tarefa 6.1 (`<ProtectedRoute requireRole="admin">`, painel
    // administrativo) — sem token role !== 'admin' nunca chega na rota, a
    // proteção nunca é só CSS (ver 6.1 no backlog).
    requireRole?: AuthUser['role']
}
