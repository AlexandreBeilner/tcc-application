import { useCallback, useState } from 'react'
import { WidgetBoundary } from '../../molecules/WidgetBoundary'
import { WidgetMission } from '../WidgetMission'
import { useWidgetMission } from '../../../features/lessons/useWidgetMission'
import type { MissionOutcome } from '../../../features/lessons/useWidgetMission'
import { WIDGET_MISSION_METRICS } from '../../../features/lessons/widgets/goal'
import { widgetRegistry } from './registry'
import type { WidgetDefinition } from './registry'
import type { WidgetId } from '../../../features/lessons/widgets/schema'
import type { LessonWidgetProps } from './types'
import styles from './index.module.css'

export type { LessonWidgetProps } from './types'
export { widgetRegistry } from './registry'

const FALLBACK_NOTICE = 'Este conteúdo interativo não está disponível agora.'

// Renderiza um bloco `widget` pelo registro (RC.3.1). Widget desconhecido ou
// com props fora do schema, ou que quebre ao renderizar, vira fallback só
// dele (a `caption` do bloco, ou um aviso discreto): o resto da lição segue.
// Cada widget tem um resumo textual no `aria-label` do grupo.
export function LessonWidget({ block, mission }: LessonWidgetProps) {
    const fallback = <p className={styles.fallback}>{block.caption ?? FALLBACK_NOTICE}</p>

    if (!(block.widget in widgetRegistry)) {
        return fallback
    }

    const definition = widgetRegistry[block.widget as WidgetId] as WidgetDefinition<WidgetId>
    const parsed = definition.propsSchema.safeParse(block.props)
    if (!parsed.success) {
        return fallback
    }

    // Missão só vale para widget que declara a métrica (o backend recusa o resto, mas o frontend não confia).
    const goal = block.goal && WIDGET_MISSION_METRICS[block.widget]?.includes(block.goal.metric) ? block.goal : undefined

    return (
        <figure className={styles.widget} role="group" aria-label={definition.summary(parsed.data as never)} data-lesson-widget="">
            {goal ? (
                <MissionWidgetBody
                    block={block}
                    goal={goal}
                    mission={mission}
                    definition={definition}
                    props={parsed.data as Record<string, unknown>}
                />
            ) : (
                <WidgetBoundary fallback={fallback}>
                    <PlainComponent definition={definition} props={parsed.data as Record<string, unknown>} />
                </WidgetBoundary>
            )}
            {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
        </figure>
    )
}

function PlainComponent({ definition, props }: { definition: WidgetDefinition<WidgetId>; props: Record<string, unknown> }) {
    const Component = definition.component as React.ComponentType<Record<string, unknown>>
    return <Component {...props} />
}

function MissionWidgetBody({
    block,
    goal,
    mission,
    definition,
    props,
}: {
    block: LessonWidgetProps['block']
    goal: NonNullable<LessonWidgetProps['block']['goal']>
    mission: LessonWidgetProps['mission']
    definition: WidgetDefinition<WidgetId>
    props: Record<string, unknown>
}) {
    // Sem controlador (prévia do painel), o estado fica aqui e nada trava.
    const [localOutcome, setLocalOutcome] = useState<MissionOutcome | undefined>(undefined)
    const outcome = mission ? mission.outcome : localOutcome
    const blockId = block.id
    const onComplete = useCallback(
        (result: MissionOutcome) => (mission ? mission.onComplete(blockId, result) : setLocalOutcome(result)),
        [mission, blockId],
    )
    const { onMetrics, onInteraction, showMe, showMeRound, showMeReady } = useWidgetMission({ goal, outcome, onComplete })

    // "Me mostra": o widget remonta com os valores-alvo mesclados às props, validados de novo pelo schema.
    let widgetProps = props
    if (showMeRound > 0 && goal.showMe) {
        const merged = definition.propsSchema.safeParse({ ...(block.props as object), ...goal.showMe })
        if (merged.success) widgetProps = merged.data as Record<string, unknown>
    }
    const Component = definition.component as React.ComponentType<Record<string, unknown>>
    const fallback = <p className={styles.fallback}>{block.caption ?? FALLBACK_NOTICE}</p>

    return (
        <>
            <WidgetMission text={goal.text} reveal={goal.reveal} outcome={outcome} showMeReady={showMeReady} onShowMe={showMe} />
            <div onChangeCapture={onInteraction} onClickCapture={onInteraction}>
                <WidgetBoundary fallback={fallback}>
                    <Component key={showMeRound} {...widgetProps} onMetrics={onMetrics} />
                </WidgetBoundary>
            </div>
        </>
    )
}
