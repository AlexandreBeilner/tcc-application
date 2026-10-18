import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useAssetBookQuery } from '../../market/useAssetBookQuery'
import { useMyAccountQuery } from '../../portfolio/useMyAccountQuery'
import { calculateFirstActionResult, FIRST_ACTION_TICKER, readFirstActionDismissed, writeFirstActionDismissed } from '../firstAction'
import type { FirstActionResult } from '../firstAction'

export interface FirstActionResultState {
    // Nulo até haver resultado a mostrar: sem posição de treino, roteiro ainda parado ou cartão dispensado.
    result: FirstActionResult | null
    dismiss: () => void
}

// Cartão do resultado da primeira ação (OB.1.2, OP2): lê a posição do Modo Aprendizado na conta e o
// preço de hoje do roteiro (`book.price`, o preço desta pessoa). A posição de Sandbox vem a custo na
// conta, então a variação só aparece comparando com o preço do book.
export function useFirstActionResult(): FirstActionResultState {
    const { user } = useAuth()
    const userId = user?.id ?? ''
    const accountQuery = useMyAccountQuery()
    const [dismissed, setDismissed] = useState(() => (userId ? readFirstActionDismissed(userId) : false))

    const position = accountQuery.data?.positions.find((candidate) => candidate.ticker === FIRST_ACTION_TICKER && candidate.quantity > 0)
    const bookQuery = useAssetBookQuery(position?.assetId ?? '', { enabled: position !== undefined && !dismissed })

    const result =
        dismissed || !position
            ? null
            : calculateFirstActionResult({ averagePrice: position.averagePrice, currentPrice: bookQuery.data?.book.price })

    function dismiss() {
        if (userId) writeFirstActionDismissed(userId)
        setDismissed(true)
    }

    return { result, dismiss }
}
