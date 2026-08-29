import { NavLink } from 'react-router-dom'
import { PieChart, Map, CandlestickChart, Calculator, Trophy } from 'lucide-react'
import styles from './index.module.css'

// Os 5 itens de navegação primária (inventário 0.1) — ordem fixa, mesma da
// spec. `end` só em "/" pra não ficar marcado ativo em toda sub-rota. Ícone
// por aba (identidade-visual-padroes.md §9) — "Mercado" usa um candlestick
// de propósito, reforça a linguagem de home broker até na navegação.
const TABS = [
    { to: '/', label: 'Portfólio', end: true, Icon: PieChart },
    { to: '/trilha', label: 'Trilha', Icon: Map },
    { to: '/mercado', label: 'Mercado', Icon: CandlestickChart },
    { to: '/calculadora', label: 'Calculadora', Icon: Calculator },
    { to: '/classificacao', label: 'Classificação', Icon: Trophy },
]

export function TabBar() {
    return (
        <nav className={styles.tabBar} aria-label="Navegação principal">
            {TABS.map(({ to, label, end, Icon }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}>
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{label}</span>
                </NavLink>
            ))}
        </nav>
    )
}
