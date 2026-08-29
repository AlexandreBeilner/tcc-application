import type { CardProps } from './types'
import styles from './index.module.css'

export type { CardProps } from './types'

// Unifica o `.card` quase idêntico de `NetWorthCards.module.css` e
// `ResumeLessonCard.module.css` (padding/radius/background/cursor/text-align/
// font-family iguais, só a cor da borda muda — tarefa 6.3.4). Sempre um
// `<button>`: os dois usos atuais navegam ao clicar; se aparecer um card
// não-clicável no futuro, ganha um `as="div"` nessa hora, não agora.
export function Card({ accent, className, type = 'button', children, ...rest }: CardProps) {
    const classes = [styles.card, accent && styles.accent, className].filter(Boolean).join(' ')

    return (
        <button type={type} className={classes} {...rest}>
            {children}
        </button>
    )
}
