import type { LessonProgressBarProps } from './types'
import styles from './index.module.css'

export type { LessonProgressBarProps } from './types'

const MARKER_CLASS = { pending: styles.markerPending, 'first-try': styles.markerFirstTry, later: styles.markerLater } as const

// Barra única da lição (LJ.1.1): avança a cada cartão e carrega um marco por pergunta. O marco acende em
// âmbar quando a pergunta foi acertada de primeira, fica neutro quando foi acertada depois e vazado enquanto
// não resolvida (forma e cor, nunca só cor). Os marcos são decoração: o leitor de tela ouve só "Cartão X de Y".
export function LessonProgressBar({ current, total, markers }: LessonProgressBarProps) {
    return (
        <div
            className={styles.bar}
            role="progressbar"
            aria-label="Progresso da lição"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current}
            aria-valuetext={`Cartão ${current} de ${total}`}
        >
            <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${(current / total) * 100}%` }} />
            </div>
            {markers.map((marker) => (
                <span
                    key={marker.position}
                    className={`${styles.marker} ${MARKER_CLASS[marker.state]}`}
                    style={{ left: `${(marker.position / total) * 100}%` }}
                    aria-hidden="true"
                />
            ))}
        </div>
    )
}
