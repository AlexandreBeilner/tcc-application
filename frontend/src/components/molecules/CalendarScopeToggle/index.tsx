import type { CalendarScope } from '../../../services/market'
import styles from './index.module.css'

interface CalendarScopeToggleProps {
    scope: CalendarScope
    onChange: (scope: CalendarScope) => void
}

const OPTIONS: { value: CalendarScope; label: string }[] = [
    { value: 'mine', label: 'Meus' },
    { value: 'all', label: 'Todos' },
]

// Controle segmentado Meus/Todos do calendário: "Meus" mostra só o que afeta o
// usuário, "Todos" soma o que acontece no mercado. O estado ativo leva `aria-checked`
// e peso de fonte, não só cor.
export function CalendarScopeToggle({ scope, onChange }: CalendarScopeToggleProps) {
    return (
        <div className={styles.toggle} role="radiogroup" aria-label="Fatos do calendário">
            {OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={scope === option.value}
                    className={`${styles.option} ${scope === option.value ? styles.active : ''}`}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
