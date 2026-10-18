// Primeira ação do onboarding (OB.1.2): uma compra guiada no Modo Aprendizado (Sandbox), pelo mesmo
// caminho de qualquer compra (`POST /market/orders`), sem regra nova de saldo nem de ranking (OP3).
// O ativo e o roteiro de preço são os do motor (`engine/internal/domain/sandbox`): R$ 100,00 no dia da
// compra e R$ 103,00 a partir do 3º dia simulado, o que acontece em menos de um dia real.
export const FIRST_ACTION_TICKER = 'SAND3'
export const FIRST_ACTION_QUANTITY = 5

// Lição que explica por que o preço mexe (oferta e demanda). O cartão do resultado leva até ela; se
// ainda estiver travada, a própria lição mostra o convite do desbloqueio.
export const FIRST_ACTION_LESSON_CODE = '2.5'

export interface FirstActionResult {
    // Variação desde a compra, como razão (0,03 = +3%).
    changeRatio: number
    averagePrice: number
    currentPrice: number
}

// O roteiro só anda com os dias simulados. Enquanto o preço de hoje for igual ao da compra, não há
// resultado a mostrar (a tela não finge uma subida que ainda não aconteceu, OP2).
export function calculateFirstActionResult(input: {
    averagePrice: number
    currentPrice: number | null | undefined
}): FirstActionResult | null {
    const { averagePrice, currentPrice } = input
    if (currentPrice === null || currentPrice === undefined || averagePrice <= 0) return null
    if (Math.abs(currentPrice - averagePrice) < 0.005) return null
    return { changeRatio: (currentPrice - averagePrice) / averagePrice, averagePrice, currentPrice }
}

export function firstActionDismissedKey(userId: string): string {
    return `app.firstAction.dismissed.${userId}`
}

export function readFirstActionDismissed(userId: string): boolean {
    try {
        return localStorage.getItem(firstActionDismissedKey(userId)) === '1'
    } catch {
        return false
    }
}

export function writeFirstActionDismissed(userId: string): void {
    try {
        localStorage.setItem(firstActionDismissedKey(userId), '1')
    } catch {
        // Sem storage (janela privada, bloqueio): o cartão só volta no próximo acesso.
    }
}
