import { computeSparklineGeometry } from '../../../utils/sparklinePath'
import type { SparklineProps } from './types'
import styles from './index.module.css'

export type { SparklineProps } from './types'

// Mini gráfico de uma série real de preços (MO.9.5), decorativo: o preço e a variação já dizem o
// mesmo em texto, por isso `aria-hidden`. Sem série (ou com menos de 2 pontos) renderiza um espaço
// do mesmo tamanho, para a linha da lista não mudar de largura quando a série chega.
export function Sparkline({ values, width = 72, height = 28, className }: SparklineProps) {
    const geometry = values ? computeSparklineGeometry(values, width, height) : null
    const style = { width, height }

    if (!geometry) {
        return <span className={`${styles.placeholder} ${className ?? ''}`} style={style} aria-hidden="true" />
    }

    return (
        <svg
            className={`${styles.sparkline} ${styles[geometry.direction]} ${className ?? ''}`}
            style={style}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path
                d={geometry.linePath}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}
