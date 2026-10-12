import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../../../features/auth/AuthContext'
import { useProEntry } from '../../../features/billing/useProEntry'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { useProgressionQuery } from '../../../features/portfolio/useProgressionQuery'
import { computeLevelProgress } from '../../../features/portfolio/levelProgress'
import { resolveMediaUrl } from '../../../services/client'
import styles from './index.module.css'

// Menu suspenso do avatar (inventário 0.2): Meu Perfil · Amigos ·
// Conquistas · Convidar · Plano PRO / Gerenciar plano (MO.9.8) · Calculadora (Ferramentas) · Configurações · Painel Admin (só role=admin) · Sair.
// "Painel Administrativo" só renderiza a partir de `user.role` — a rota
// `/admin` em si também é protegida por `<ProtectedRoute requireRole=
// "admin">` (router.tsx), nunca só escondida aqui via CSS (critério de
// aceite da tarefa 6.1).
export function AvatarMenu() {
    const { user, logout } = useAuth()
    const progressionQuery = useProgressionQuery()
    const navigate = useNavigate()
    // A Calculadora saiu da barra principal (MO.9.6) e mora aqui, com o mesmo gate de trilha: antes de
    // desbloquear mostra o cadeado e a rota abre o card de bloqueio (`RequiresUnlock`).
    const { unlockedKeys, isLoading: unlockLoading, isError: unlockError } = useUnlockedKeys()
    const calculatorLocked = !unlockLoading && !unlockError && !unlockedKeys.has('calculator')
    const proEntry = useProEntry()
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
    const avatarUrl = resolveMediaUrl(user?.avatarUrl ?? null)
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
            <div
                className={styles.ring}
                style={ringStyle}
                title={progression ? `Nível ${progression.level}, ${progression.xp} XP` : undefined}
            >
                <button
                    type="button"
                    className={styles.trigger}
                    onClick={() => setOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label="Menu do usuário"
                >
                    {avatarUrl ? <img className={styles.avatarImage} src={avatarUrl} alt="" /> : initial}
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
                    <Link to="/convidar" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                        Convidar amigos
                    </Link>
                    {proEntry === 'visitor' && (
                        <Link
                            to="/planos"
                            state={{ proSource: 'menu' }}
                            className={styles.item}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                        >
                            Plano PRO
                        </Link>
                    )}
                    {proEntry === 'subscriber' && (
                        <Link to="/configuracoes" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
                            Gerenciar plano
                        </Link>
                    )}
                    <div className={styles.groupLabel} role="presentation">
                        Ferramentas
                    </div>
                    <Link
                        to="/calculadora"
                        className={`${styles.item} ${styles.itemWithIcon}`}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        aria-label={calculatorLocked ? 'Calculadora travada pela trilha' : undefined}
                    >
                        Calculadora
                        {calculatorLocked && <Lock size={14} strokeWidth={2} aria-hidden="true" className={styles.lockIcon} />}
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
