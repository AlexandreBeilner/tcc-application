import { useCallback, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../../features/auth/AuthContext'
import { useActiveAnnouncements } from '../../../features/announcements/useActiveAnnouncements'
import { AnnouncementBanner } from '../../organisms/AnnouncementBanner'
import { TopBar } from '../../organisms/TopBar'
import { TabBar } from '../../organisms/TabBar'
import { MarketCalendarPanel } from '../../organisms/MarketCalendarPanel'
import styles from './index.module.css'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — a rota de auth (1.1) fica fora do shell,
// montada direto no router. `/onboarding` (1.2) também fica fora: entra
// como irmã do shell dentro de <ProtectedRoute>, não como filha daqui.
export function AppShell() {
    const { user } = useAuth()
    const [calendarOpen, setCalendarOpen] = useState(false)
    const { announcements, dismiss } = useActiveAnnouncements()
    const toggleCalendar = useCallback(() => setCalendarOpen((open) => !open), [])
    const closeCalendar = useCallback(() => setCalendarOpen(false), [])

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
            {/* Comunicados globais (N.20): faixa acima de tudo, dispensável por sessão. */}
            <AnnouncementBanner announcements={announcements} onDismiss={dismiss} />
            <TopBar calendarOpen={calendarOpen} onToggleCalendar={toggleCalendar} />
            <TabBar />
            {/* Calendário do mercado (S.12): aberto só pelo chip do relógio, sem rota. */}
            <div className={styles.body}>
                {calendarOpen && <MarketCalendarPanel onClose={closeCalendar} />}
                <main className={styles.content}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
