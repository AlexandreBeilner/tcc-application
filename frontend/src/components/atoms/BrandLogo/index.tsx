import type { ReactNode } from 'react'
import markDark from '../../../assets/selucra-icone-branco.png'
import markLight from '../../../assets/selucra-icone.png'
import horizontalDark from '../../../assets/selucra-logo-horizontal-branco.png'
import horizontalLight from '../../../assets/selucra-logo-horizontal.png'
import styles from './index.module.css'

// Logo horizontal da marca. A versão azul vai no tema claro e a branca no escuro;
// as duas ficam no DOM e o CSS alterna por `data-theme` no <html>, sem depender do
// `ThemeContext` (evita piscar a cor errada antes do React hidratar o tema). `width`/`height`
// reservam o espaço antes de a imagem carregar (CSS força altura e largura automática).
// `compactOnMobile` troca a logo horizontal pelo ícone abaixo de 768px (cabeçalho apertado), e
// `badge` fica no canto inferior direito da logo (selo PRO do cabeçalho, MO.9.8).
interface BrandLogoProps {
    className?: string
    compactOnMobile?: boolean
    badge?: ReactNode
}

export function BrandLogo({ className, compactOnMobile = false, badge }: BrandLogoProps) {
    return (
        <span className={`${styles.logo} ${compactOnMobile ? styles.compact : ''} ${className ?? ''}`}>
            <img className={`${styles.full} ${styles.onLight}`} src={horizontalLight} alt="Selucra" width={800} height={176} />
            <img className={`${styles.full} ${styles.onDark}`} src={horizontalDark} alt="" aria-hidden="true" width={800} height={176} />
            {compactOnMobile && (
                <>
                    <img className={`${styles.mark} ${styles.onLight}`} src={markLight} alt="Selucra" width={1024} height={983} />
                    <img className={`${styles.mark} ${styles.onDark}`} src={markDark} alt="" aria-hidden="true" width={1024} height={983} />
                </>
            )}
            {badge && <span className={styles.badge}>{badge}</span>}
        </span>
    )
}
