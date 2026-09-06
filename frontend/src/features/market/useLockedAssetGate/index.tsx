import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockedAssetBadge } from '../../../components/molecules/LockedAssetBadge'
import type { AssetSummary } from '../../../services/market'
import { assetUnlockKey, findLessonUnlocking } from '../../lessons/unlockedKeys'
import { useUnlockedKeys } from '../../lessons/useUnlockedKeys'

export interface UseLockedAssetGateResult {
    isLocked: (asset: AssetSummary) => boolean
    lockedBadge: (asset: AssetSummary) => React.ReactNode
    selectOrRedirectToLesson: (asset: AssetSummary, detailPath: string) => void
}

// Extraído de `EquityList`/`FixedIncomeList` (tarefa 7.0.1, revisão da
// Semana 7): as duas telas repetiam `isLocked`, o cadeado da coluna
// Ticker/Produto e o redirecionamento de `handleSelect` pra lição que
// desbloqueia — reflexo de UX, a garantia de verdade continua sendo o 403
// do backend (`ProductLockedError`, `.docs/backend/market.md`).
export function useLockedAssetGate(): UseLockedAssetGateResult {
    const navigate = useNavigate()
    const { unlockedKeys, lessons } = useUnlockedKeys()

    const isLocked = useCallback(
        (asset: AssetSummary) => !asset.is_sandbox && !unlockedKeys.has(assetUnlockKey(asset.type)),
        [unlockedKeys],
    )

    const lockedBadge = useCallback(
        (asset: AssetSummary) =>
            isLocked(asset) ? (
                <LockedAssetBadge lessonCode={findLessonUnlocking(assetUnlockKey(asset.type), lessons)?.code} />
            ) : null,
        [isLocked, lessons],
    )

    const selectOrRedirectToLesson = useCallback(
        (asset: AssetSummary, detailPath: string) => {
            if (isLocked(asset)) {
                const hint = findLessonUnlocking(assetUnlockKey(asset.type), lessons)
                navigate(hint ? `/trilha/${hint.id}` : '/trilha')
                return
            }
            navigate(detailPath)
        },
        [isLocked, lessons, navigate],
    )

    return { isLocked, lockedBadge, selectOrRedirectToLesson }
}
