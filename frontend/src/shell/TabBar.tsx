import { NavLink } from 'react-router-dom'
import styles from './TabBar.module.css'

// Os 5 itens de navegação primária (inventário 0.1) — ordem fixa, mesma da
// spec. `end` só em "/" pra não ficar marcado ativo em toda sub-rota.
const TABS = [
  { to: '/', label: 'Portfólio', end: true },
  { to: '/trilha', label: 'Trilha' },
  { to: '/mercado', label: 'Mercado' },
  { to: '/calculadora', label: 'Calculadora' },
  { to: '/classificacao', label: 'Classificação' },
]

export function TabBar() {
  return (
    <nav className={styles.tabBar} aria-label="Navegação principal">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
