import styles from './index.module.css'

// Número de destaque com rótulo (retrospectiva, MO.5.4). Valor já formatado por quem usa.
export function MetricTile({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.tile}>
            <span className={`${styles.value} tabular-nums`}>{value}</span>
            <span className={styles.label}>{label}</span>
        </div>
    )
}
