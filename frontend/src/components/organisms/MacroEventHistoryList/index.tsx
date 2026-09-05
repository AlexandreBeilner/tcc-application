import { formatSignedPercent } from '../../../features/market/format'
import { resolveTargets } from '../../../features/news/resolveTargets'
import type { MacroEvent } from '../../../services/admin'
import type { MacroEventHistoryListProps } from './types'
import styles from './index.module.css'

export type { MacroEventHistoryListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

const DIRECTION_LABELS: Record<MacroEvent['direction'], string> = {
    positivo: 'Alta',
    negativo: 'Baixa',
    misto: 'Misto',
}

const MAGNITUDE_LABELS: Record<MacroEvent['magnitude_band'], string> = {
    leve: 'Leve',
    moderado: 'Moderado',
    severo: 'Severo',
}

function directionClass(direction: MacroEvent['direction']): string {
    if (direction === 'positivo') return styles.positivo
    if (direction === 'negativo') return styles.negativo
    return styles.misto
}

// Tela 10.1 (RF14) — histórico de eventos disparados pelo painel admin.
// Reaproveita a mesma convenção visual sólido/tracejado de `NewsEventList`
// (identidade-visual-padroes.md §3), mas **sem** o gate "só revela direção/
// magnitude/efeito quando `status = aplicado`" da 5.1 (tarefa 6.6.3): lá é
// um mecanismo pedagógico pro jogador não ler o veredito antes da hora;
// aqui é o admin monitorando o que ele mesmo disparou, o "spoiler" não faz
// sentido nesta tela. Todo o conteúdo do evento aparece de imediato.
export function MacroEventHistoryList({ events, assetLabels = {}, onSelectAsset }: MacroEventHistoryListProps) {
    if (events.length === 0) {
        return <p className={styles.empty}>Nenhum evento macro disparado ainda.</p>
    }

    return (
        <ul className={styles.list}>
            {events.map((event) => {
                const applied = event.status === 'aplicado'

                return (
                    <li key={event.id}>
                        <details className={styles.item}>
                            <summary className={styles.summary}>
                                <span className={`${styles.statusBadge} ${applied ? styles.statusAplicado : styles.statusPendente}`}>
                                    {applied ? 'Aplicado' : 'Pendente'}
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
                                    <span>Disparado no dia simulado {event.triggered_on_day}</span>
                                    {event.template_key && <span>Template: {event.template_key}</span>}
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
                )
            })}
        </ul>
    )
}
