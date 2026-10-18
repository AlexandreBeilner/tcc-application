import type { CheckBlock } from '../../../features/lessons/widgets/schema'

// Como a pergunta de prática terminou: resolvida ou não, e se houve erro no caminho ("de primeira" = sem erro).
export interface PracticeOutcome {
    solved: boolean
    missed: boolean
}

export interface PracticeCheckpointProps {
    // Lição de origem da pergunta: a resposta vai para a rota de checkpoint dela (leitura, não grava).
    lessonId: string
    lessonTitle: string
    block: CheckBlock
    // Selo do cartão: "Relembra?" (LJ.5.5) ou "Revisão" (LJ.5.6).
    badge: string
    // Chamado uma vez quando a pergunta se resolve, ou ao sair dela depois de ao menos um erro (sem resolver).
    onSettle?: (outcome: PracticeOutcome) => void
    onContinue: () => void
    continueLabel?: string
}
