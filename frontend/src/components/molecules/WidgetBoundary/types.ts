import type { ReactNode } from 'react'

export interface WidgetBoundaryProps {
    fallback: ReactNode
    children: ReactNode
}

export interface WidgetBoundaryState {
    failed: boolean
}
