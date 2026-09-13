import { NavLink, useNavigate } from 'react-router-dom'
import { PieChart, Map, CandlestickChart, Calculator, Trophy, Lock } from 'lucide-react'
import { findLessonUnlocking, safeUnlockPath } from '../../../features/lessons/unlockedKeys'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import styles from './index.module.css'

// Os 5 itens de navegação primária (inventário 0.1) — ordem fixa, mesma da
// spec. `end` só em "/" pra não ficar marcado ativo em toda sub-rota. Ícone
// por aba (identidade-visual-padroes.md §9) — "Mercado" usa um candlestick
// de propósito, reforça a linguagem de home broker até na navegação.
// `unlockKey` (tarefa 7.0.1): Portfólio/Calculadora só viram link de
// verdade depois de 0.1/0.2 concluídas — antes disso a aba fica travada
// (ícone de cadeado, cor apagada), mesmo gate real de `RequiresUnlock` que
// protege as rotas (aqui é só o reflexo visual, não a garantia). Travada
// não é beco sem saída (tarefa J.1): clicar navega pra lição que
// desbloqueia aquela chave via `safeUnlockPath` (tarefa N.3) — cai no Mapa
// da Trilha em vez de na lição se ela ainda não for alcançável, mesma
// garantia usada em `LockedAssetPanel`/`AssetDetail` (N.2), preventivo aqui
// já que `portfolio`/`calculator` hoje sempre desbloqueiam nas 2 primeiras
// lições da trilha. A legenda visível com o código da lição (`.lockHint`,
// tarefa J.2) saiu na Fase Q — "Lição X.X" não pode aparecer em nenhum
// texto de UI fora do próprio Mapa da Trilha (decisão do autor,
// 2026-09-12); o `aria-label` também não cita mais o código, só o rótulo
// da aba. Enquanto `GET /lessons` ainda não resolveu ou falhou
// (`isLoading`/`isError`), `unlockedKeys` vem vazio sem significar "nada
// desbloqueado" — renderiza como link normal nesse meio-tempo pra não
// piscar cadeado numa aba que o usuário já desbloqueou (mesmo cuidado de
// `RequiresUnlock`).
const TABS = [
    { to: '/', label: 'Portfólio', end: true, Icon: PieChart, unlockKey: 'portfolio' },
    { to: '/trilha', label: 'Trilha', Icon: Map, unlockKey: undefined },
    { to: '/mercado', label: 'Mercado', Icon: CandlestickChart, unlockKey: undefined },
    { to: '/calculadora', label: 'Calculadora', Icon: Calculator, unlockKey: 'calculator' },
    { to: '/classificacao', label: 'Classificação', Icon: Trophy, unlockKey: undefined },
]

export function TabBar() {
    const navigate = useNavigate()
    const { unlockedKeys, lessons, isLoading, isError } = useUnlockedKeys()

    return (
        <nav className={styles.tabBar} aria-label="Navegação principal">
            {TABS.map(({ to, label, end, Icon, unlockKey }) => {
                const locked = !isLoading && !isError && unlockKey !== undefined && !unlockedKeys.has(unlockKey)

                if (locked) {
                    const hint = findLessonUnlocking(unlockKey, lessons)

                    return (
                        <button
                            key={to}
                            type="button"
                            className={`${styles.tab} ${styles.locked}`}
                            aria-label={`${label} travado pela trilha`}
                            onClick={() => navigate(hint ? safeUnlockPath(hint) : '/trilha')}
                        >
                            <Lock size={18} strokeWidth={2} aria-hidden="true" />
                            <span aria-hidden="true">{label}</span>
                        </button>
                    )
                }

                return (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
                    >
                        <Icon size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{label}</span>
                    </NavLink>
                )
            })}
        </nav>
    )
}
