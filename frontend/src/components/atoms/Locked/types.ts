export interface LockedProps {
    // Tamanho do ícone de cadeado em px — cada chamador hoje usa um
    // tamanho diferente (14 no badge de linha, 16 no nó da trilha, 20 no
    // painel de bloqueio), então fica explícito por chamador em vez de um
    // padrão que não serviria a nenhum dos 3 casos reais.
    size: number
    // Texto curto visível ao lado do ícone (tarefa J.2 — motivo do
    // bloqueio não pode depender só de hover/tooltip). Omitido quando o
    // chamador já mostra o motivo em outro elemento (ex: `LockedGate`
    // tem título/descrição próprios; `LessonNode`/`TrackPath` já têm
    // tooltip/meta separados).
    label?: string
}
