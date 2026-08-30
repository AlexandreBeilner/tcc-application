import { useState } from 'react'
import { GrowthCalculatorForm } from '../../components/organisms/GrowthCalculatorForm'
import { FixedIncomeComparisonForm } from '../../components/organisms/FixedIncomeComparisonForm'
import styles from './index.module.css'

type Mode = 'simple' | 'compare'

const MODE_LABEL: Record<Mode, string> = { simple: 'Calculadora', compare: 'Comparar produtos' }

// Telas 6.1 (modo simples, wireframe original Fig. 7) e 6.2 (modo
// comparação, lição 3.3) — a mesma tela de Calculadora, "toggle 'Comparar
// produtos'" (inventário, ação de 6.1) alterna entre as duas, sem
// navegação nova (6.2: "nenhuma navegação nova — é uma variação de estado
// da mesma tela"). 100% client-side (backlog 6.7) — nenhum dado
// persistido.
export function Calculator() {
    const [mode, setMode] = useState<Mode>('simple')

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Calculadora</h1>

            <div className={styles.tabs}>
                {(['simple', 'compare'] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        className={[styles.tab, option === mode && styles.tabActive].filter(Boolean).join(' ')}
                        onClick={() => setMode(option)}
                    >
                        {MODE_LABEL[option]}
                    </button>
                ))}
            </div>

            {mode === 'simple' ? <GrowthCalculatorForm /> : <FixedIncomeComparisonForm />}
        </main>
    )
}
