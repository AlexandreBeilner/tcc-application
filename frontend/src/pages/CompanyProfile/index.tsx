import { useNavigate, useParams } from 'react-router-dom'
import { CompanyAssetList } from '../../components/organisms/CompanyAssetList'
import { CompanyFundamentalsChart } from '../../components/organisms/CompanyFundamentalsChart'
import { useCompanyQuery } from '../../features/market/useCompanyQuery'
import styles from './index.module.css'

// Tela 4.6 — consolida os fundamentos históricos da empresa, separando
// "empresa" de "ativo negociável" (inventário). Histórico de eventos macro
// que afetaram a empresa (inventário: "conecta com o Feed") fica fora
// desta sessão: `GET /news`/`GET /admin/macro-events` (`.docs/backend/
// news.md`) não expõe `targets` na resposta, então não há como filtrar
// "eventos que afetaram esta empresa" sem um endpoint novo do motor — e
// o motor não é tocado de novo depois da semana 4 (decisão da introdução
// da Semana 6). Revisitar se o feed ganhar esse campo no futuro.
export function CompanyProfile() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const companyQuery = useCompanyQuery(id as string)
    const company = companyQuery.data?.company

    if (companyQuery.isError) {
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    Não foi possível carregar esta empresa agora. Tente novamente em instantes.
                </p>
            </main>
        )
    }

    if (!company) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando empresa…</p>
            </main>
        )
    }

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>{company.name}</h1>
                <p className={styles.subtitle}>
                    {company.sector} · CNPJ {company.cnpj}
                </p>
            </header>

            <section className={styles.section}>
                <span className={styles.sectionTitle}>Receita líquida por ciclo de relatório</span>
                <CompanyFundamentalsChart fundamentals={company.fundamentals} />
            </section>

            <section className={styles.section}>
                <span className={styles.sectionTitle}>Ativos emitidos</span>
                <CompanyAssetList assets={company.assets} onSelect={(asset) => navigate(`/mercado/ativos/${asset.id}`)} />
            </section>
        </main>
    )
}
