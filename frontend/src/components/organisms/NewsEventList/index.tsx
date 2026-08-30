import { formatSignedPercent } from '../../../features/market/format'
import { resolveTargets } from '../../../features/news/resolveTargets'
import type { NewsEvent } from '../../../services/news'
import type { NewsEventListProps } from './types'
import styles from './index.module.css'

export type { NewsEventListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

const DIRECTION_LABELS: Record<NewsEvent['direction'], string> = {
    positivo: 'Alta',
    negativo: 'Baixa',
    misto: 'Misto',
}

const MAGNITUDE_LABELS: Record<NewsEvent['magnitude_band'], string> = {
    leve: 'Leve',
    moderado: 'Moderado',
    severo: 'Severo',
}

function directionClass(direction: NewsEvent['direction']): string {
    if (direction === 'positivo') return styles.positivo
    if (direction === 'negativo') return styles.negativo
    return styles.misto
}

// Tela 5.1 (RF16) — pendente/aplicado segue a convenção sólido vs.
// tracejado (identidade-visual-padroes.md §3): tracejado = efeito ainda em
// curso/aguardando confirmação, sólido = já encerrado. Reforça
// pedagogicamente "preço reage à expectativa, resultado confirma depois".
export function NewsEventList({ events, assetLabels = {}, onEventRead, onSelectAsset }: NewsEventListProps) {
    if (events.length === 0) {
        return <p className={styles.empty}>Nenhum evento de mercado disparado ainda.</p>
    }

    return (
        <ul className={styles.list}>
            {events.map((event) => (
                <li key={event.id}>
                    <details
                        className={styles.item}
                        onToggle={(e) => {
                            if (e.currentTarget.open) onEventRead?.()
                        }}
                    >
                        <summary className={styles.summary}>
                            <span
                                className={`${styles.statusBadge} ${event.status === 'aplicado' ? styles.statusAplicado : styles.statusPendente}`}
                            >
                                {event.status === 'aplicado' ? 'Aplicado' : 'Pendente'}
                            </span>
                            <span className={styles.title}>{event.title}</span>
                            <span className={styles.date}>{dateFormatter.format(new Date(event.created_at))}</span>
                            <span className={`${styles.direction} ${directionClass(event.direction)}`}>
                                {DIRECTION_LABELS[event.direction]}
                            </span>
                        </summary>

                        <div className={styles.details}>
                            <p className={styles.narrative}>{event.narrative}</p>

                            <div className={styles.meta}>
                                <span>Magnitude: {MAGNITUDE_LABELS[event.magnitude_band]}</span>
                                {event.affects_price && event.price_effect_pct !== undefined && (
                                    <span className={`tabular-nums ${directionClass(event.direction)}`}>
                                        Efeito de preço: {formatSignedPercent(event.price_effect_pct)}
                                    </span>
                                )}
                                {event.affects_fundamentals && event.fundamentals_effect_pct !== undefined && (
                                    <span className={`tabular-nums ${directionClass(event.direction)}`}>
                                        Efeito nos fundamentos: {formatSignedPercent(event.fundamentals_effect_pct)}
                                    </span>
                                )}
                            </div>

                            {event.targets.length > 0 && (
                                <div className={styles.targets}>
                                    {resolveTargets(event.targets, assetLabels).map((target) =>
                                        target.assetId ? (
                                            <button
                                                key={target.key}
                                                type="button"
                                                className={styles.targetChip}
                                                onClick={() => onSelectAsset?.(target.assetId as string)}
                                            >
                                                {target.label}
                                            </button>
                                        ) : (
                                            <span key={target.key} className={styles.targetChip}>
                                                {target.label}
                                            </span>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                    </details>
                </li>
            ))}
        </ul>
    )
}
