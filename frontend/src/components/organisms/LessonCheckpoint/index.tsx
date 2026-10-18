import { ChoiceCheckpoint } from '../ChoiceCheckpoint'
import { CategorizeCheckpoint } from '../CategorizeCheckpoint'
import { EstimateCheckpoint } from '../EstimateCheckpoint'
import { OrderCheckpoint } from '../OrderCheckpoint'
import type { LessonCheckpointProps } from './types'

export type { LessonCheckpointProps } from './types'

// Despachante das perguntas intermediárias (bloco `check`): escolhe o componente pelo `kind`.
// Cada formato novo da LJ.2 entra aqui com um componente próprio em `components/organisms/`.
// Todos recebem a mesma `view` e devolvem a resposta por `onSubmit`.
export function LessonCheckpoint({ block, ...rest }: LessonCheckpointProps) {
    switch (block.kind) {
        case 'single':
        case 'true_false':
            return <ChoiceCheckpoint block={block} {...rest} />
        case 'estimate':
            return <EstimateCheckpoint block={block} {...rest} />
        case 'categorize':
            return <CategorizeCheckpoint block={block} {...rest} />
        case 'order':
            return <OrderCheckpoint block={block} {...rest} />
    }
}
