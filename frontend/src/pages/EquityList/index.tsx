import { useState } from 'react'
import { Delta } from '../../components/atoms/Delta'
import { AssetTable, AssetTableSkeleton } from '../../components/organisms/AssetTable'
import type { AssetTableColumn } from '../../components/organisms/AssetTable'
import { Pagination } from '../../components/molecules/Pagination'
import { ASSETS_PAGE_SIZE, EQUITY_TABS, filterAssetsByTab } from '../../features/market/assetTabs'
import { useAssetPriceSeriesQuery } from '../../features/market/useAssetPriceSeriesQuery'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { useLockedAssetGate } from '../../features/market/useLockedAssetGate'
import type { UseLockedAssetGateResult } from '../../features/market/useLockedAssetGate'
import { formatCurrency } from '../../features/portfolio/format'
import { useClientPagination } from '../../hooks/useClientPagination'
import type { AssetSummary } from '../../services/market'
import styles from './index.module.css'

function priceColumn(asset: AssetSummary): string {
    return asset.current_price !== undefined ? formatCurrency(asset.current_price) : 'aguardando cotação'
}

function changeColumn(asset: AssetSummary) {
    return <Delta percent={asset.daily_change_pct} />
}

// Colunas de Ações incluem risco (inventário 4.4); ETF/FII ficam com o
// mesmo par preço/variação — `benchmark_index`/perfil-segmento/Dividend
// Yield só existem em `GET /market/assets/:id` (mesma decisão de escopo
// da 4.2, `pages/FixedIncomeList`: listar isso na 4.4 exigiria N+1
// chamadas de detalhe).
//
// Gate de desbloqueio da coluna Ticker (tarefa 7.0.1) vive inteiro em
// `useLockedAssetGate` (extraído da revisão da Semana 7, compartilhado com
// `pages/FixedIncomeList`) — reflexo de UX, a garantia de verdade é o 403
// do backend (`ProductLockedError`).
function buildColumnsByTab(gate: UseLockedAssetGateResult): Record<string, AssetTableColumn[]> {
    function tickerColumn(asset: AssetSummary) {
        return (
            <span className={styles.tickerCell}>
                {gate.lockedBadge(asset)}
                {asset.ticker}
            </span>
        )
    }

    const ticker: AssetTableColumn = { key: 'ticker', header: 'Ticker', render: tickerColumn, slot: 'title' }
    const name: AssetTableColumn = { key: 'name', header: 'Nome', render: (asset) => asset.name, slot: 'subtitle' }
    const price: AssetTableColumn = { key: 'price', header: 'Último preço', render: priceColumn, slot: 'price', align: 'end' }
    const change: AssetTableColumn = { key: 'change', header: 'Variação do dia', render: changeColumn, slot: 'change', align: 'end' }

    return {
        acoes: [ticker, name, { key: 'risk', header: 'Risco', render: (asset) => asset.risk_class ?? '—', slot: 'tag' }, price, change],
        etfs: [ticker, name, price, change],
        fiis: [ticker, name, price, change],
    }
}

export function EquityList() {
    const [activeTabKey, setActiveTabKey] = useState(EQUITY_TABS[0].key)
    const assetsQuery = useAssetsQuery()
    const gate = useLockedAssetGate()
    const priceSeriesQuery = useAssetPriceSeriesQuery()
    const columnsByTab = buildColumnsByTab(gate)

    const activeTab = EQUITY_TABS.find((tab) => tab.key === activeTabKey) ?? EQUITY_TABS[0]
    const assets = assetsQuery.data ? filterAssetsByTab(assetsQuery.data.assets, activeTab) : []
    const { page: currentPage, totalPages, pageItems: pageAssets, setPage, resetPage } = useClientPagination(assets, ASSETS_PAGE_SIZE)

    function handleSelect(asset: AssetSummary) {
        gate.selectAsset(`/mercado/ativos/${asset.id}`)
    }

    function handleTabChange(tabKey: string) {
        setActiveTabKey(tabKey)
        resetPage()
    }

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Renda Variável</h1>

            <div className={styles.tabs}>
                {EQUITY_TABS.map((tab) => (
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
                    Não foi possível carregar os ativos agora. Tente novamente em instantes.
                </p>
            )}

            {!assetsQuery.data && !assetsQuery.isError && <AssetTableSkeleton />}

            {assetsQuery.data && (
                <>
                    <AssetTable
                        assets={pageAssets}
                        columns={columnsByTab[activeTab.key]}
                        onSelect={handleSelect}
                        sparklines={priceSeriesQuery.data?.series ?? {}}
                        emptyMessage="Nenhum ativo disponível nesta categoria ainda."
                    />
                    <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} ariaLabel="Paginação de Renda Variável" />
                </>
            )}
        </main>
    )
}
