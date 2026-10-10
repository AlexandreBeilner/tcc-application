import type { AssetBook, OrderSide } from '../../../services/market'

export interface EquityOrderTicketProps {
    unitPrice?: number
    // Book do ativo (tarefa S.5/S.7) — melhor bid/ask e profundidade real,
    // insumo do custo estimado e de "Usar o máximo". `undefined` enquanto
    // carrega ou pra ativo sandbox (book sempre `null`, RF12/RNF08) — nesse
    // caso o ticket cai pro comportamento anterior (só `unitPrice`).
    book?: AssetBook
    // Saldo em caixa (tarefa S.7) — insumo de "Usar o máximo" do lado de
    // compra (`maxAffordableQuantity`).
    cashBalance?: number
    // Quantidade já possuída deste ativo (tarefa S.7) — insumo de "Usar o
    // máximo" do lado de venda (vender tudo, não depende do book).
    ownedQuantity?: number
    // Motivo em texto de a ordem estar bloqueada agora (mercado fechado, tarefa S.11); desabilita o botão.
    closedReason?: string | null
    onSubmit: (side: OrderSide, quantity: number) => void
}
