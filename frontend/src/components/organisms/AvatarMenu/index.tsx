import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/AuthContext'
import { useProgressionQuery } from '../../../features/portfolio/useProgressionQuery'
import { computeLevelProgress } from '../../../features/portfolio/levelProgress'
import styles from './index.module.css'

// Menu suspenso do avatar (inventário 0.2): Meu Perfil · Amigos ·
// Conquistas · Configurações · Painel Admin (só role=admin) · Sair.
// "Painel Administrativo" só renderiza a partir de `user.role` — a rota
// `/admin` em si também é protegida por `<ProtectedRoute requireRole=
// "admin">` (router.tsx), nunca só escondida aqui via CSS (critério de
// aceite da tarefa 6.1).
export function AvatarMenu() {
    const { user, logout } = useAuth()
    const progressionQuery = useProgressionQuery()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        function handleClickOutside(event: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    function handleSair() {
        setOpen(false)
        logout()
        navigate('/login', { replace: true })
    }

    const initial = user?.name?.charAt(0).toUpperCase() ?? '?'
    const progression = progressionQuery.data
    // Anel de progresso de XP (identidade-visual-padroes.md) — nunca 0%
    // "quebrado" enquanto a query carrega: sem dado, o anel fica neutro
    // (só a cor de borda, sem trecho dourado).
    const ringPercent = progression ? computeLevelProgress(progression.xp, progression.level).progressRatio * 100 : 0
    const ringStyle = {
        background: `conic-gradient(var(--color-gamify-500) ${ringPercent}%, var(--color-border) ${ringPercent}%)`,
    }

    return (
        <div className={styles.root} ref={rootRef}>
            <div className={styles.ring} style={ringStyle} title={progression ? `Nível ${progression.level}, ${progression.xp} XP` : undefined}>
                <button
                    type="button"
                    className={styles.trigger}
                    onClick={() => setOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="Menu do usuário"
                >
                    {initial}
                </button>
            </div>

            {open && (
                <div className={styles.menu} role="menu">
                    <Link to="/perfil" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                        Meu Perfil
                    </Link>
                    <Link to="/amigos" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                        Amigos
                    </Link>
                    <Link to="/conquistas" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                        Conquistas
                    </Link>
                    <Link to="/configuracoes" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                        Configurações e Privacidade
                    </Link>
                    {user?.role === 'admin' && (
                        <Link to="/admin" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                            Painel Administrativo
                        </Link>
                    )}
                    <button type="button" className={styles.item} role="menuitem" onClick={handleSair}>
                        Sair
                    </button>
                </div>
            )}
        </div>
    )
}
