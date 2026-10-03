import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { Pagination } from '../../components/molecules/Pagination'
import { MacroEventHistoryList } from '../../components/organisms/MacroEventHistoryList'
import { useAssetLabels } from '../../features/market/useAssetLabels'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { useMacroEventsQuery } from '../../features/admin/useMacroEventsQuery'
import styles from './index.module.css'

// Tela 10.3 (RF14) — histórico de eventos macro disparados, acesso
// restrito a `role = admin` (rota protegida em `router.tsx`, dentro do
// `AdminShell`, seção "Mercado"). Era o hub `/admin` (10.1) até a N.3: o
// hub passou a ser a Visão geral (`AdminVisaoGeral`). "Novo evento" leva pra 10.2 (`CriarEventoMacro`); ao
// voltar de lá com sucesso, o evento novo já aparece no topo (`created_at
// DESC`, `.docs/engine/macroevent.md`) sem refetch manual — a mutation de
// disparo já invalida esta mesma query key.
export function AdminEventosMacro() {
    const navigate = useNavigate()
    const [page, setPage] = useState(1)
    const eventsQuery = useMacroEventsQuery(page)
    const assetsQuery = useAssetsQuery()
    const assetLabels = useAssetLabels(assetsQuery.data?.assets)

    return (
        <main className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Eventos macro</h1>
                <Button onClick={() => navigate('/admin/eventos/novo')}>Novo evento</Button>
            </div>

            <p className={styles.subtitle}>Histórico de eventos macro disparados (RF13/RF14), mais recentes primeiro.</p>

            {eventsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o histórico agora. Tente novamente em instantes.
                </p>
            )}

            {eventsQuery.isLoading && <p className={styles.loading}>Carregando histórico…</p>}

            {eventsQuery.data && (
                <>
                    <MacroEventHistoryList
                        events={eventsQuery.data.events}
                        assetLabels={assetLabels}
                        onSelectAsset={(assetId) => navigate(`/mercado/ativos/${assetId}`)}
                    />

                    <Pagination
                        page={eventsQuery.data.page}
                        totalPages={eventsQuery.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação do histórico de eventos macro"
                    />
                </>
            )}
        </main>
    )
}
