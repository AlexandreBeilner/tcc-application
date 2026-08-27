import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { TopBar } from './TopBar'
import { TabBar } from './TabBar'
import styles from './AppShell.module.css'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — a rota de auth (1.1) fica fora do shell,
// montada direto no router. `/onboarding` (1.2) também fica fora: entra
// como irmã do shell dentro de <ProtectedRoute>, não como filha daqui.
export function AppShell() {
  const { user } = useAuth()

  // <ProtectedRoute> já garante usuário carregado antes de chegar aqui
  // (tarefa 6.0.2) — falta só decidir onboarding (1.2) vs. resto do app,
  // sempre a partir de `user.onboardingCompleted` (GET /auth/me), nunca um
  // flag local (critério de aceite da tarefa 6.2) — cobre login, cadastro
  // e o retorno do OAuth Google com a mesma decisão central.
  if (user && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className={styles.shell}>
      <TopBar />
      <TabBar />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
