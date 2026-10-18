import { useAssetByTicker } from '../../market/useAssetByTicker'
import { useAssetBookQuery } from '../../market/useAssetBookQuery'
import { usePlaceOrderMutation } from '../../market/usePlaceOrderMutation'
import { FIRST_ACTION_QUANTITY, FIRST_ACTION_TICKER } from '../firstAction'

export interface FirstActionPurchase {
    assetName: string | undefined
    ticker: string
    quantity: number
    // Preço do roteiro para esta pessoa (Sandbox, `book.price`); indefinido enquanto carrega.
    unitPrice: number | undefined
    isLoading: boolean
    // O ativo ou o preço não vieram: a etapa continua pulável.
    isUnavailable: boolean
    isBuying: boolean
    buy: () => Promise<void>
}

// Insumos e ação da compra guiada do onboarding (OB.1.2). `buy` rejeita se a ordem falhar; quem chama
// decide a mensagem (o onboarding nunca trava por isso).
export function useFirstActionPurchase(): FirstActionPurchase {
    const { asset, isLoading: assetLoading, isError: assetError } = useAssetByTicker(FIRST_ACTION_TICKER)
    const bookQuery = useAssetBookQuery(asset?.id ?? '', { enabled: asset !== undefined })
    const placeOrder = usePlaceOrderMutation()

    const unitPrice = bookQuery.data?.book.price ?? undefined
    const isLoading = assetLoading || (asset !== undefined && bookQuery.isLoading)
    const isUnavailable = assetError || bookQuery.isError || (!isLoading && (asset === undefined || unitPrice === undefined))

    async function buy() {
        if (!asset) throw new Error('ativo de treino indisponível')
        await placeOrder.mutateAsync({ asset_id: asset.id, side: 'buy', type: 'market', quantity: FIRST_ACTION_QUANTITY })
    }

    return {
        assetName: asset?.name,
        ticker: FIRST_ACTION_TICKER,
        quantity: FIRST_ACTION_QUANTITY,
        unitPrice,
        isLoading,
        isUnavailable,
        isBuying: placeOrder.isPending,
        buy,
    }
}
