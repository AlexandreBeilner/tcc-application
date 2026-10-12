import type { EmailCategoryOptionProps } from './types'
import styles from './index.module.css'

// Uma categoria opcional de e-mail com título e explicação (EM.6.1). Compartilhada pela seção de
// Configurações e pela pergunta do onboarding: as duas ligam e desligam as mesmas categorias.
export function EmailCategoryOption({ title, description, checked, disabled, onChange }: EmailCategoryOptionProps) {
    return (
        <label className={styles.option}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
            <span className={styles.text}>
                <span className={styles.title}>{title}</span>
                <span className={styles.description}>{description}</span>
            </span>
        </label>
    )
}
