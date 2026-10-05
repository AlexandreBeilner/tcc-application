import type { TradingHalt } from '../../../services/admin'

export interface TradingHaltListProps {
    halts: TradingHalt[]
    // Pausas vigentes mostram "Retomar"; o histórico não.
    onLift?: (halt: TradingHalt) => void
    // Id da pausa em retomada, pra travar só o botão dela.
    liftingId?: string | null
    emptyMessage: string
}
