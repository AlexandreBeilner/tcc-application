import { Circle, CircleCheck } from 'lucide-react'
import { Button } from '../../atoms/Button'
import type { MissionOutcome } from '../../../features/lessons/useWidgetMission'
import styles from './index.module.css'

interface WidgetMissionProps {
    text: string
    reveal: string
    outcome: MissionOutcome | undefined
    showMeReady: boolean
    onShowMe: () => void
}

// Faixa da missão de um widget (LJ.3.1): "Missão: ..." com um alvo vazio que se preenche ao atingir. Ao atingir
// aparece o que a pessoa descobriu (`aria-live`, então o leitor de tela anuncia). Depois de bastante tentativa,
// "Me mostra" leva os controles ao valor-alvo (LJ-D4).
export function WidgetMission({ text, reveal, outcome, showMeReady, onShowMe }: WidgetMissionProps) {
    const done = outcome !== undefined
    return (
        <div className={styles.mission} data-done={done ? '' : undefined}>
            <p className={styles.goal}>
                {done ? (
                    <CircleCheck className={styles.targetDone} size={20} aria-hidden="true" />
                ) : (
                    <Circle className={styles.target} size={20} aria-hidden="true" />
                )}
                <span>
                    <span className={styles.label}>Missão: </span>
                    {text}
                </span>
            </p>
            <div role="status" aria-live="polite" className={styles.live}>
                {done && <p className={styles.reveal}>{outcome === 'later' ? `Aqui está. ${reveal}` : reveal}</p>}
            </div>
            {showMeReady && (
                <Button variant="secondary" onClick={onShowMe}>
                    Me mostra
                </Button>
            )}
        </div>
    )
}
