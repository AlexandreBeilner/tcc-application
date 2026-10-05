import { useState } from 'react'
import { AdminAchievementsPanel } from '../../components/organisms/AdminAchievementsPanel'
import { AdminMissionsPanel } from '../../components/organisms/AdminMissionsPanel'
import { AdminRankingPanel } from '../../components/organisms/AdminRankingPanel'
import styles from './index.module.css'

type Tab = 'achievements' | 'missions' | 'ranking'

const TABS: { key: Tab; label: string }[] = [
    { key: 'achievements', label: 'Conquistas' },
    { key: 'missions', label: 'Missões diárias' },
    { key: 'ranking', label: 'Ranking' },
]

// Tela "Gamificação" (N.19): catálogo de conquistas e de missões diárias, operável pelo painel, e a leitura
// do ranking da janela corrente. Cada aba só monta (e só consulta) quando aberta. Toda edição é auditada
// e desativar nunca remove o que o usuário já ganhou.
export function AdminGamificacao() {
    const [tab, setTab] = useState<Tab>('achievements')

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Gamificação</h1>
                <p className={styles.subtitle}>
                    Conquistas, missões diárias e ranking. Mudanças valem para as próximas concessões e conclusões, e nada que um usuário já
                    ganhou é removido.
                </p>
            </header>

            <div role="tablist" aria-label="Seções de gamificação" className={styles.tabs}>
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`gamification-tab-${key}`}
                        aria-selected={tab === key}
                        aria-controls={`gamification-panel-${key}`}
                        className={`${styles.tab} ${tab === key ? styles.active : ''}`}
                        onClick={() => setTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`gamification-panel-${tab}`} aria-labelledby={`gamification-tab-${tab}`}>
                {tab === 'achievements' && <AdminAchievementsPanel />}
                {tab === 'missions' && <AdminMissionsPanel />}
                {tab === 'ranking' && <AdminRankingPanel active />}
            </div>
        </main>
    )
}
