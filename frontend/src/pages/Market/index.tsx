import { useNavigate } from 'react-router-dom'
import { ClipboardList, Landmark, LineChart, TrendingUp } from 'lucide-react'
import { Card } from '../../components/atoms/Card'
import styles from './index.module.css'

// Tela 4.1 (inventário) — roteador principal entre Renda Fixa e Renda
// Variável, sem dado próprio (backlog 6.5: "4.1 é só roteamento"). Estado
// especial de ativo bloqueado pela trilha aparece dentro das listas
// (4.2/4.4), não aqui.
export function Market() {
    const navigate = useNavigate()

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Mercado</h1>

            <div className={styles.cards}>
                <Card className={styles.card} onClick={() => navigate('/mercado/renda-fixa')}>
                    <span className={styles.icon} aria-hidden="true">
                        <Landmark size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.cardTitle}>Renda Fixa</span>
                    <span className={styles.cardBody}>Tesouro Direto, CDBs, LCA, LCI, CRI e CRA: produtos conservadores.</span>
                </Card>

                <Card className={styles.card} onClick={() => navigate('/mercado/renda-variavel')}>
                    <span className={styles.icon} aria-hidden="true">
                        <TrendingUp size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.cardTitle}>Renda Variável</span>
                    <span className={styles.cardBody}>Ações, ETFs e FIIs: negociação a preço de mercado.</span>
                </Card>

                <Card className={styles.card} onClick={() => navigate('/mercado/indicadores')}>
                    <span className={styles.icon} aria-hidden="true">
                        <LineChart size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.cardTitle}>Indicadores Econômicos</span>
                    <span className={styles.cardBody}>Selic e IPCA simulados: os indicadores por trás do rendimento dos produtos.</span>
                </Card>

                <Card className={styles.card} onClick={() => navigate('/mercado/ordens')}>
                    <span className={styles.icon} aria-hidden="true">
                        <ClipboardList size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.cardTitle}>Minhas Ordens</span>
                    <span className={styles.cardBody}>
                        Acompanhe ordens pendentes, executadas e recusadas, e cancele o que ainda não fechou.
                    </span>
                </Card>
            </div>
        </main>
    )
}
