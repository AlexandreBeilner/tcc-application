import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AssetTable } from '../../components/organisms/AssetTable'
import type { AssetTableColumn } from '../../components/organisms/AssetTable'
import { LockedAssetBadge } from '../../components/molecules/LockedAssetBadge'
import { Pagination } from '../../components/molecules/Pagination'
import { assetUnlockKey, findLessonUnlocking } from '../../features/lessons/unlockedKeys'
import { useUnlockedKeys } from '../../features/lessons/useUnlockedKeys'
import { ASSETS_PAGE_SIZE, FIXED_INCOME_TABS, filterAssetsByTab } from '../../features/market/assetTabs'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { useClientPagination } from '../../hooks/useClientPagination'
import type { AssetSummary } from '../../services/market'
import styles from './index.module.css'

// Tela 4.2 — abas Tesouro Direto/CDBs-LCA-LCI/CRI-CRA (inventário). `GET
// /market/assets` (sem `type=`) lista o catálogo inteiro; o agrupamento
// por aba é 100% client-side (backend só filtra pelos 11 tipos crus,
// `features/market/assetTabs`). Colunas limitadas ao que `AssetSummary`
// tem (ticker/nome/risco) — taxa/vencimento/aplicação mínima/badges
// (isento de IR, risco de crédito, tipo de emissor) só existem em `GET
// /market/assets/:id` (tela 4.3): decisão de escopo desta sessão, listar
// tudo isso exigiria uma chamada de detalhe por ativo (N+1), o motor não
// é tocado de novo depois da semana 4 pra ganhar um endpoint de lista
// enriquecida.
// `isLocked`/`lessons` (tarefa 7.0.1): a coluna Produto ganha
// `LockedAssetBadge` pra todo produto real ainda travado pela trilha —
// reflexo de UX, a garantia de verdade é o 403 do backend
// (`ProductLockedError`).
function buildColumns(
    isLocked: (asset: AssetSummary) => boolean,
    lessons: Parameters<typeof findLessonUnlocking>[1],
): AssetTableColumn[] {
    return [
        {
            key: 'ticker',
            header: 'Produto',
            render: (asset) => {
                const locked = isLocked(asset)
                return (
                    <span className={styles.tickerCell}>
                        {locked && <LockedAssetBadge lessonCode={findLessonUnlocking(assetUnlockKey(asset.type), lessons)?.code} />}
                        {asset.ticker}
                    </span>
                )
            },
        },
        { key: 'name', header: 'Nome', render: (asset) => asset.name },
        { key: 'risk', header: 'Risco', render: (asset) => asset.risk_class ?? '—' },
    ]
}

export function FixedIncomeList() {
    const navigate = useNavigate()
    const [activeTabKey, setActiveTabKey] = useState(FIXED_INCOME_TABS[0].key)
    const assetsQuery = useAssetsQuery()
    const { unlockedKeys, lessons } = useUnlockedKeys()

    const isLocked = useCallback(
        (asset: AssetSummary) => !asset.is_sandbox && !unlockedKeys.has(assetUnlockKey(asset.type)),
        [unlockedKeys],
    )

    const columns = useMemo(() => buildColumns(isLocked, lessons), [isLocked, lessons])

    const activeTab = FIXED_INCOME_TABS.find((tab) => tab.key === activeTabKey) ?? FIXED_INCOME_TABS[0]
    const assets = assetsQuery.data ? filterAssetsByTab(assetsQuery.data.assets, activeTab) : []
    const { page: currentPage, totalPages, pageItems: pageAssets, setPage, resetPage } = useClientPagination(assets, ASSETS_PAGE_SIZE)

    function handleSelect(asset: AssetSummary) {
        if (isLocked(asset)) {
            const hint = findLessonUnlocking(assetUnlockKey(asset.type), lessons)
            navigate(hint ? `/trilha/${hint.id}` : '/trilha')
            return
        }
        navigate(`/mercado/renda-fixa/${asset.id}`)
    }

    function handleTabChange(tabKey: string) {
        setActiveTabKey(tabKey)
        resetPage()
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Renda Fixa</h1>

            <div className={styles.tabs}>
                {FIXED_INCOME_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={[styles.tab, tab.key === activeTabKey && styles.tabActive].filter(Boolean).join(' ')}
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {assetsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar os produtos agora. Tente novamente em instantes.
                </p>
            )}

            {!assetsQuery.data && !assetsQuery.isError && <p className={styles.loading}>Carregando produtos…</p>}

            {assetsQuery.data && (
                <>
                    <AssetTable
                        assets={pageAssets}
                        columns={columns}
                        onSelect={handleSelect}
                        emptyMessage="Nenhum produto disponível nesta categoria ainda."
                    />
                    <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} ariaLabel="Paginação de Renda Fixa" />
                </>
            )}
        </main>
    )
}
