import { Navigate, Outlet } from 'react-router-dom'
import type { AuthUser } from '../api/auth'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  // Usado pela tarefa 6.1 (`<ProtectedRoute requireRole="admin">`, painel
  // administrativo) — sem token role !== 'admin' nunca chega na rota, a
  // proteção nunca é só CSS (ver 6.1 no backlog).
  requireRole?: AuthUser['role']
}

export function ProtectedRoute({ requireRole }: ProtectedRouteProps) {
  const { token, user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
