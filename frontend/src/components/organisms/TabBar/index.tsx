import { NavLink } from 'react-router-dom'
import { PieChart, Map, CandlestickChart, Calculator, Trophy, Lock } from 'lucide-react'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import styles from './index.module.css'

// Os 5 itens de navegação primária (inventário 0.1) — ordem fixa, mesma da
// spec. `end` só em "/" pra não ficar marcado ativo em toda sub-rota. Ícone
// por aba (identidade-visual-padroes.md §9) — "Mercado" usa um candlestick
// de propósito, reforça a linguagem de home broker até na navegação.
// `unlockKey` (tarefa 7.0.1): Portfólio/Calculadora só viram link de
// verdade depois de 0.1/0.2 concluídas — antes disso a aba fica travada
// (ícone de cadeado, sem navegação), mesmo gate real de `RequiresUnlock`
// que protege as rotas (aqui é só o reflexo visual, não a garantia).
// Enquanto `GET /lessons` ainda não resolveu ou falhou (`isLoading`/
// `isError`), `unlockedKeys` vem vazio sem significar "nada desbloqueado"
// — renderiza como link normal nesse meio-tempo pra não piscar cadeado
// numa aba que o usuário já desbloqueou (mesmo cuidado de `RequiresUnlock`).
const TABS = [
    { to: '/', label: 'Portfólio', end: true, Icon: PieChart, unlockKey: 'portfolio' },
    { to: '/trilha', label: 'Trilha', Icon: Map, unlockKey: undefined },
    { to: '/mercado', label: 'Mercado', Icon: CandlestickChart, unlockKey: undefined },
    { to: '/calculadora', label: 'Calculadora', Icon: Calculator, unlockKey: 'calculator' },
    { to: '/classificacao', label: 'Classificação', Icon: Trophy, unlockKey: undefined },
]

export function TabBar() {
    const { unlockedKeys, isLoading, isError } = useUnlockedKeys()

    return (
        <nav className={styles.tabBar} aria-label="Navegação principal">
            {TABS.map(({ to, label, end, Icon, unlockKey }) => {
                const locked = !isLoading && !isError && unlockKey !== undefined && !unlockedKeys.has(unlockKey)

                if (locked) {
                    return (
                        <span key={to} className={`${styles.tab} ${styles.locked}`} aria-disabled="true">
                            <Lock size={18} strokeWidth={2} aria-hidden="true" />
                            <span>{label}</span>
                        </span>
                    )
                }

                return (
                    <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}>
                        <Icon size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{label}</span>
                    </NavLink>
                )
            })}
        </nav>
    )
}
