import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface OrderBookWidgetProps extends MissionWidgetProps {
    // Ponto de partida do formulário (missão e "Me mostra"): sem eles, começa em ordem a mercado e preço limite de R$ 10,00.
    orderType?: 'market' | 'limit'
    limitPrice?: number
}
