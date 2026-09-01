import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AssetTable } from '../../components/organisms/AssetTable'
import type { AssetTableColumn } from '../../components/organisms/AssetTable'
import { Pagination } from '../../components/molecules/Pagination'
import { ASSETS_PAGE_SIZE, EQUITY_TABS, filterAssetsByTab } from '../../features/market/assetTabs'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { formatSignedPercent } from '../../features/market/format'
import { formatCurrency } from '../../features/portfolio/format'
import type { AssetSummary } from '../../services/market'
import styles from './index.module.css'

function priceColumn(asset: AssetSummary): string {
    return asset.current_price !== undefined ? formatCurrency(asset.current_price) : 'aguardando cotação'
}

function changeColumn(asset: AssetSummary): string {
    return asset.daily_change_pct !== undefined ? formatSignedPercent(asset.daily_change_pct) : '—'
}

// Colunas de Ações incluem risco (inventário 4.4); ETF/FII ficam com o
// mesmo par preço/variação — `benchmark_index`/perfil-segmento/Dividend
// Yield só existem em `GET /market/assets/:id` (mesma decisão de escopo
// da 4.2, `pages/FixedIncomeList`: listar isso na 4.4 exigiria N+1
// chamadas de detalhe).
const COLUMNS_BY_TAB: Record<string, AssetTableColumn[]> = {
    acoes: [
        { key: 'ticker', header: 'Ticker', render: (asset) => asset.ticker },
        { key: 'risk', header: 'Risco', render: (asset) => asset.risk_class ?? '—' },
        { key: 'price', header: 'Último preço', render: priceColumn },
        { key: 'change', header: 'Variação do dia', render: changeColumn },
    ],
    etfs: [
        { key: 'ticker', header: 'Ticker', render: (asset) => asset.ticker },
        { key: 'name', header: 'Nome', render: (asset) => asset.name },
        { key: 'price', header: 'Último preço', render: priceColumn },
        { key: 'change', header: 'Variação do dia', render: changeColumn },
    ],
    fiis: [
        { key: 'ticker', header: 'Ticker', render: (asset) => asset.ticker },
        { key: 'name', header: 'Nome', render: (asset) => asset.name },
        { key: 'price', header: 'Último preço', render: priceColumn },
        { key: 'change', header: 'Variação do dia', render: changeColumn },
    ],
}

export function EquityList() {
    const navigate = useNavigate()
    const [activeTabKey, setActiveTabKey] = useState(EQUITY_TABS[0].key)
    const [page, setPage] = useState(1)
    const assetsQuery = useAssetsQuery()

    const activeTab = EQUITY_TABS.find((tab) => tab.key === activeTabKey) ?? EQUITY_TABS[0]
    const assets = assetsQuery.data ? filterAssetsByTab(assetsQuery.data.assets, activeTab) : []
    const totalPages = Math.max(1, Math.ceil(assets.length / ASSETS_PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const pageAssets = assets.slice((currentPage - 1) * ASSETS_PAGE_SIZE, currentPage * ASSETS_PAGE_SIZE)

    function handleSelect(asset: AssetSummary) {
        navigate(`/mercado/ativos/${asset.id}`)
    }

    function handleTabChange(tabKey: string) {
        setActiveTabKey(tabKey)
        setPage(1)
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

            {!assetsQuery.data && !assetsQuery.isError && <p className={styles.loading}>Carregando ativos…</p>}

            {assetsQuery.data && (
                <>
                    <AssetTable
                        assets={pageAssets}
                        columns={COLUMNS_BY_TAB[activeTab.key]}
                        onSelect={handleSelect}
                        emptyMessage="Nenhum ativo disponível nesta categoria ainda."
                    />
                    <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} ariaLabel="Paginação de Renda Variável" />
                </>
            )}
        </main>
    )
}
