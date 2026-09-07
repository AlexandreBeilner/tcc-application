import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockedAssetBadge } from '../../../components/molecules/LockedAssetBadge'
import type { AssetSummary } from '../../../services/market'
import type { LessonUnlockHint } from '../../lessons/unlockedKeys'
import { assetUnlockKey, findLessonUnlocking } from '../../lessons/unlockedKeys'
import { useUnlockedKeys } from '../../lessons/useUnlockedKeys'

export interface UseLockedAssetGateResult {
    isLocked: (asset: AssetSummary) => boolean
    lockedBadge: (asset: AssetSummary) => React.ReactNode
    unlockingLessonFor: (asset: AssetSummary) => LessonUnlockHint | undefined
    selectAsset: (detailPath: string) => void
}

// Extraído de `EquityList`/`FixedIncomeList` (tarefa 7.0.1, revisão da
// Semana 7): as duas telas repetiam `isLocked` e o cadeado da coluna
// Ticker/Produto — reflexo de UX, a garantia de verdade continua sendo o
// 403 do backend (`ProductLockedError`, `.docs/backend/market.md`).
// `selectAsset` navega sempre pro Detalhe, travado ou não (tarefa J.3,
// achado da auditoria: o usuário nunca chegava a ver indicadores/gráfico
// de um ativo travado, tudo somente leitura — a trava real é só no POST de
// ordem/compra). `AssetDetail` usa `unlockingLessonFor` pra montar o
// banner "Travado — desbloqueia na lição X" que substitui o painel de
// compra quando `isLocked` é verdadeiro.
export function useLockedAssetGate(): UseLockedAssetGateResult {
    const navigate = useNavigate()
    const { unlockedKeys, lessons } = useUnlockedKeys()

    const isLocked = useCallback(
        (asset: AssetSummary) => !asset.is_sandbox && !unlockedKeys.has(assetUnlockKey(asset.type)),
        [unlockedKeys],
    )

    const unlockingLessonFor = useCallback((asset: AssetSummary) => findLessonUnlocking(assetUnlockKey(asset.type), lessons), [lessons])

    const lockedBadge = useCallback(
        (asset: AssetSummary) => (isLocked(asset) ? <LockedAssetBadge lessonCode={unlockingLessonFor(asset)?.code} /> : null),
        [isLocked, unlockingLessonFor],
    )

    const selectAsset = useCallback((detailPath: string) => navigate(detailPath), [navigate])

    return { isLocked, lockedBadge, unlockingLessonFor, selectAsset }
}
