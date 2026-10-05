import { WidgetBoundary } from '../../molecules/WidgetBoundary'
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
export function LessonWidget({ block }: LessonWidgetProps) {
    const fallback = <p className={styles.fallback}>{block.caption ?? FALLBACK_NOTICE}</p>

    if (!(block.widget in widgetRegistry)) {
        return fallback
    }

    const definition = widgetRegistry[block.widget as WidgetId] as WidgetDefinition<WidgetId>
    const parsed = definition.propsSchema.safeParse(block.props)
    if (!parsed.success) {
        return fallback
    }

    const Component = definition.component as React.ComponentType<Record<string, unknown>>

    return (
        <figure className={styles.widget} role="group" aria-label={definition.summary(parsed.data as never)}>
            <WidgetBoundary fallback={fallback}>
                <Component {...(parsed.data as Record<string, unknown>)} />
            </WidgetBoundary>
            {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
        </figure>
    )
}
