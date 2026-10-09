import { Component } from 'react'
import type { ErrorInfo } from 'react'
import type { WidgetBoundaryProps, WidgetBoundaryState } from './types'

export type { WidgetBoundaryProps } from './types'

// Error boundary de um widget de lição (RC.3.1): um widget que lança durante
// o render mostra o `fallback` no lugar dele, em vez de derrubar o player.
export class WidgetBoundary extends Component<WidgetBoundaryProps, WidgetBoundaryState> {
    state: WidgetBoundaryState = { failed: false }

    static getDerivedStateFromError(): WidgetBoundaryState {
        return { failed: true }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('widget de lição falhou', error, info.componentStack)
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children
    }
}
