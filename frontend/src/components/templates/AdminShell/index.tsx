import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { AdminReauthProvider } from '../../../features/admin/AdminReauth'
import { AdminNav } from '../../organisms/AdminNav'
import styles from './index.module.css'

// Template do painel admin (Fase N, tarefa N.3): navegação por seções +
// `<Outlet/>` da seção atual, dentro do `AppShell` (TopBar/TabBar do app
// continuam). Uma só árvore, três composições (identidade-visual-padroes.md):
// desktop >= 1024px barra lateral fixa à esquerda; tablet 768-1023px faixa
// horizontal acima do conteúdo; mobile < 768px gaveta aberta por um botão.
// O `<aside>` é o mesmo elemento nos três casos (só o CSS muda) — assim a
// navegação existe uma vez no DOM e a gaveta fechada fica `visibility:
// hidden`, fora da ordem de tabulação.
export function AdminShell() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const closeDrawer = useCallback(() => setDrawerOpen(false), [])

    useEffect(() => {
        if (!drawerOpen) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setDrawerOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [drawerOpen])

    return (
        <AdminReauthProvider>
            <div className={styles.shell}>
                <button
                    type="button"
                    className={styles.menuButton}
                    aria-expanded={drawerOpen}
                    aria-controls="admin-sections"
                    onClick={() => setDrawerOpen((open) => !open)}
                >
                    <Menu size={18} aria-hidden="true" />
                    Menu do painel
                </button>

                {drawerOpen && <div className={styles.scrim} data-testid="admin-scrim" onClick={closeDrawer} />}

                <aside id="admin-sections" className={drawerOpen ? `${styles.sidebar} ${styles.open}` : styles.sidebar}>
                    <div className={styles.drawerHead}>
                        <span className={styles.drawerTitle}>Painel administrativo</span>
                        <button type="button" className={styles.closeButton} aria-label="Fechar menu do painel" onClick={closeDrawer}>
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <AdminNav onNavigate={closeDrawer} />
                </aside>

                <div className={styles.content}>
                    <Outlet />
                </div>
            </div>
        </AdminReauthProvider>
    )
}
