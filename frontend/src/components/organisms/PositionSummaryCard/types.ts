export interface PositionSummaryCardProps {
    quantity: number
    averagePrice: number
    // Preço de marcação a mercado (tarefa S.6) — ausente pra posição sem
    // book real; o card cai pro `averagePrice` (mesmo fallback de sempre).
    markPrice?: number
    // Proventos recebidos nesse ativo, em R$ (tarefa S.15) — sempre presente,
    // `0` sem provento nenhum.
    dividendsReceived: number
}
