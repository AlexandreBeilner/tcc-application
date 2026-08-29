export interface PositionLike {
    isSandbox: boolean
    quantity: number
    averagePrice: number
}

export interface AccountTotals {
    liveInvested: number
    sandboxInvested: number
}
