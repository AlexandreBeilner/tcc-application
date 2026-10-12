export interface PositionLike {
    isSandbox: boolean
    quantity: number
    averagePrice: number
    markPrice?: number
    currentValue?: number
}

export interface AccountTotals {
    liveInvested: number
    sandboxInvested: number
}
