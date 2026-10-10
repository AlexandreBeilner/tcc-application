import { ArrowLeftRight, Banknote, CircleDollarSign, FileText, HandCoins, Landmark, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CalendarEventKind } from '../../../services/market'

const ICON: Record<CalendarEventKind, LucideIcon> = {
    macro_event: Zap,
    copom: Landmark,
    report: FileText,
    dividend_ex_date: CircleDollarSign,
    dividend_payment_date: CircleDollarSign,
    dividend_received: CircleDollarSign,
    order_executed: ArrowLeftRight,
    fixed_income_purchase: Banknote,
    fixed_income_redemption: Banknote,
    fixed_income_maturity: Banknote,
    salary_payment: HandCoins,
}

// Ícone por tipo de fato do calendário. Decorativo: quem usa sempre escreve o
// tipo em texto ao lado (cor e ícone nunca são o único sinal).
export function CalendarKindIcon({ kind, size = 16 }: { kind: CalendarEventKind; size?: number }) {
    const Icon = ICON[kind]
    return <Icon size={size} strokeWidth={2} aria-hidden="true" />
}
