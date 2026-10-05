import { useState } from 'react'
import { COPOM_MEETINGS_PER_YEAR } from '../../../features/lessons/widgets/macroMath'
import type { CopomTimelineWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { CopomTimelineWidgetProps } from './types'

const MEETINGS = Array.from({ length: COPOM_MEETINGS_PER_YEAR }, (_, index) => index + 1)

// Widget `copom-timeline` (RC.3.4c): o ano com as 8 reuniões do Copom como
// marcos selecionáveis. As datas exatas mudam todo ano (o Banco Central divulga
// o calendário até junho do ano anterior), então o widget mostra o ritmo e o que
// acontece em cada reunião, nunca um dia do calendário.
export function CopomTimelineWidget(_props: CopomTimelineWidgetProps) {
    const [selected, setSelected] = useState(1)

    return (
        <div className={styles.root}>
            <ol className={styles.timeline} aria-label={`As ${COPOM_MEETINGS_PER_YEAR} reuniões do Copom em um ano`}>
                {MEETINGS.map((meeting) => (
                    <li key={meeting}>
                        <button
                            type="button"
                            className={styles.timelineMark}
                            aria-pressed={selected === meeting}
                            onClick={() => setSelected(meeting)}
                        >
                            {meeting}
                        </button>
                    </li>
                ))}
            </ol>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Reunião {selected} de {COPOM_MEETINGS_PER_YEAR}
                </p>
                <p>O Copom se reúne em dois dias seguidos. No segundo dia o comitê decide a meta da Selic.</p>
                <p>O comunicado da decisão sai a partir das 18h30 desse segundo dia.</p>
                <p>A próxima reunião vem cerca de 45 dias depois, porque o ano tem {COPOM_MEETINGS_PER_YEAR} reuniões ordinárias.</p>
            </div>
        </div>
    )
}

export function copomTimelineSummary(_props: CopomTimelineWidgetProps): string {
    return `Linha do tempo de um ano com as ${COPOM_MEETINGS_PER_YEAR} reuniões ordinárias do Copom, cerca de 45 dias entre elas, com a decisão e o comunicado no segundo dia de cada reunião.`
}
