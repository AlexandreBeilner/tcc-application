import { Brain } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCheckpoints } from '../../../features/lessons/useCheckpoints'
import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import { Button } from '../../atoms/Button'
import { LessonCheckpoint } from '../LessonCheckpoint'
import type { PracticeCheckpointProps } from './types'
import styles from './index.module.css'

export type { PracticeCheckpointProps, PracticeOutcome } from './types'

// Houve erro no caminho? Cada formato deixa um rastro diferente na `view`.
function showsMiss(view: CheckpointView): boolean {
    return (
        view.lastAttemptWrong ||
        view.wrongOptions.length > 0 ||
        view.hint !== undefined ||
        view.lastMiss !== undefined ||
        (view.estimate !== undefined && view.estimate.band !== 'exact')
    )
}

// Pergunta de prática (LJ.5.5 "Relembra?", LJ.5.6 revisão de 1 minuto): uma pergunta de lição já concluída,
// respondida pela rota de checkpoint da lição de origem em modo leitura (nada é gravado) e com `practice`,
// então a explicação vem também no erro. É prática, não prova: errar nunca trava o Continuar (quem não quer
// resolver pode pular) e nada aqui mexe em XP, placar ou sequência da lição.
export function PracticeCheckpoint({ lessonId, lessonTitle, block, badge, onSettle, onContinue, continueLabel }: PracticeCheckpointProps) {
    const checkpoints = useCheckpoints(lessonId, undefined, true, { practice: true })
    const view = checkpoints.viewFor(block.id)
    // Houve erro em algum momento (cada formato some com o rastro do erro ao resolver, então guarda-se aqui).
    const [missedSeen, setMissedSeen] = useState(false)
    const settledRef = useRef(false)
    // Guardado durante a renderização (e não num efeito): o rastro do erro some da `view` ao resolver.
    if (showsMiss(view) && !missedSeen) setMissedSeen(true)

    useEffect(() => {
        if (view.solved && !settledRef.current) {
            settledRef.current = true
            onSettle?.({ solved: true, missed: missedSeen })
        }
    }, [view, missedSeen, onSettle])

    function handleContinue() {
        if (!view.solved && missedSeen && !settledRef.current) {
            settledRef.current = true
            onSettle?.({ solved: false, missed: true })
        }
        onContinue()
    }

    const missed = missedSeen

    return (
        <div className={styles.practice}>
            <p className={styles.badge}>
                <Brain size={16} aria-hidden="true" />
                {badge}
            </p>
            <p className={styles.origin}>Da lição: {lessonTitle}</p>

            <LessonCheckpoint
                block={block}
                view={view}
                pending={checkpoints.isPending}
                error={checkpoints.isError}
                isReview
                onSubmit={(response) => checkpoints.submit(block, response)}
            />

            {view.solved && (
                <p role="status" className={styles.result}>
                    {missed ? 'Agora ficou.' : 'Isso ficou!'}
                </p>
            )}
            {!view.solved && view.practiceExplanation && (
                <div className={styles.explanation} role="note">
                    <strong>Pra fixar</strong>
                    <p>{view.practiceExplanation}</p>
                </div>
            )}

            <div className={styles.actions}>
                <Button onClick={handleContinue} variant={view.solved ? 'primary' : 'secondary'} data-lesson-continue="">
                    {continueLabel ?? (view.solved ? 'Continuar' : 'Pular')}
                </Button>
            </div>
        </div>
    )
}
