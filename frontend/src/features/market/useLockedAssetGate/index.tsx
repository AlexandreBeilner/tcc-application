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
// `selectAsset` navega sempre pro Detalhe, travado ou não (a lista nunca
// desabilita a linha — o bloqueio é da "funcionalidade" ativo travado, não
// do clique em si) — mas desde a Fase Q o Detalhe (`AssetDetail`/
// `FixedIncomeDetail`) vira parede total quando `isLocked`, substituindo
// TODO o conteúdo (chart/indicadores/simulador) pelo card de
// `LockedGate` via `unlockingLessonFor`, reversão da "prévia, não
// parede" da Fase J.
export function useLockedAssetGate(): UseLockedAssetGateResult {
    const navigate = useNavigate()
    const { unlockedKeys, lessons } = useUnlockedKeys()

    const isLocked = useCallback(
        (asset: AssetSummary) => !asset.is_sandbox && !unlockedKeys.has(assetUnlockKey(asset.type)),
        [unlockedKeys],
    )

    const unlockingLessonFor = useCallback((asset: AssetSummary) => findLessonUnlocking(assetUnlockKey(asset.type), lessons), [lessons])

    const lockedBadge = useCallback((asset: AssetSummary) => (isLocked(asset) ? <LockedAssetBadge /> : null), [isLocked])

    const selectAsset = useCallback((detailPath: string) => navigate(detailPath), [navigate])

    return { isLocked, lockedBadge, unlockingLessonFor, selectAsset }
}
