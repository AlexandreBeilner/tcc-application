import type { ReactNode } from 'react'

export interface RewardRevealContent {
    icon: ReactNode
    title: string
    description?: string
}

export interface RewardRevealContextValue {
    show(content: RewardRevealContent): void
}
