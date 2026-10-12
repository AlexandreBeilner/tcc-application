// Valor atual de uma posição, a base única do patrimônio, da rosca e da tela de ativos: renda
// variável = quantidade × marcação (queda: preço médio); renda fixa = valor bruto avaliado pelo
// motor (queda: o custo, nunca um zero inventado).
export function positionCurrentValue(position: {
    quantity: number
    averagePrice: number
    markPrice?: number
    currentValue?: number
}): number {
    return position.currentValue ?? position.quantity * (position.markPrice ?? position.averagePrice)
}
