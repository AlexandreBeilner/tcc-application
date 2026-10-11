import horizontalDark from '../../../assets/selucra-logo-horizontal-branco.png'
import horizontalLight from '../../../assets/selucra-logo-horizontal.png'
import styles from './index.module.css'

// Logo horizontal da marca. A versão azul vai no tema claro e a branca no escuro;
// as duas ficam no DOM e o CSS alterna por `data-theme` no <html>, sem depender do
// `ThemeContext` (evita piscar a cor errada antes do React hidratar o tema).
interface BrandLogoProps {
    className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
    return (
        <span className={`${styles.logo} ${className ?? ''}`}>
            <img className={styles.onLight} src={horizontalLight} alt="Selucra" />
            <img className={styles.onDark} src={horizontalDark} alt="" aria-hidden="true" />
        </span>
    )
}
