import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import type { ProtectedRouteProps } from './types'

export type { ProtectedRouteProps } from './types'

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
