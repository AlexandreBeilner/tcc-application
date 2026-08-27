import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { TabBar } from './TabBar'
import styles from './AppShell.module.css'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — a rota de auth (1.1) fica fora do shell,
// montada direto no router.
export function AppShell() {
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
