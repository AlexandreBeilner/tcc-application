import type { WidgetBlock } from '../../../features/lessons/widgets/schema'
import type { MissionOutcome } from '../../../features/lessons/useWidgetMission'

// Estado da missão guardado pelo player (sobrevive a Voltar). Sem ele, o widget guarda o estado sozinho
// (prévia do painel admin), sem travar nada.
export interface WidgetMissionController {
    outcome: MissionOutcome | undefined
    onComplete: (blockId: string, outcome: MissionOutcome) => void
}

export interface LessonWidgetProps {
    block: WidgetBlock
    mission?: WidgetMissionController
}
