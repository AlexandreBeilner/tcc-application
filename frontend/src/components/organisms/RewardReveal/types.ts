import type { ReactNode } from 'react'

export interface RewardRevealProps {
    icon: ReactNode
    title: string
    description?: string
    onDismiss(): void
}
