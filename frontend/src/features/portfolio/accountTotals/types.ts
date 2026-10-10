export interface PositionLike {
    isSandbox: boolean
    quantity: number
    averagePrice: number
    markPrice?: number
}

export interface AccountTotals {
    liveInvested: number
    sandboxInvested: number
}
