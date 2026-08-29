import type { ButtonProps } from './types'
import styles from './index.module.css'

export type { ButtonProps } from './types'

// Unifica os 3 blocos de CSS quase idênticos que existiam em
// `Portfolio.module.css` (`.primaryButton`/`.secondaryButton`),
// `Login.module.css` (`.submit`) e `Onboarding.module.css` (`.next`) —
// mesmo padding/radius/background brand-500/hover brand-600/disabled:opacity
// nos três (tarefa 6.3.4). `fullWidth` cobre o `width: 100%` do "Avançar"
// do Onboarding.
export function Button({ variant = 'primary', fullWidth, className, type = 'button', ...rest }: ButtonProps) {
    const classes = [styles.button, variant === 'primary' ? styles.primary : styles.secondary, fullWidth && styles.fullWidth, className]
        .filter(Boolean)
        .join(' ')

    return <button type={type} className={classes} {...rest} />
}
