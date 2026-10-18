import { useId } from 'react'
import type { AdminFieldProps } from './types'
import styles from './index.module.css'

export type { AdminFieldProps } from './types'

// Campo de formulário do painel: rótulo, controle e dica. O controle usa a classe `input` daqui
// (`AdminField.inputClass`) para os formulários do painel terem o mesmo aspecto.
export function AdminField({ label, hint, children }: AdminFieldProps) {
    const id = useId()
    return (
        <div className={styles.field}>
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
            {children(id)}
            {hint && <span className={styles.hint}>{hint}</span>}
        </div>
    )
}

export const adminInputClass = styles.input
