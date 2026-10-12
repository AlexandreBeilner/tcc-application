import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from '../PoliticaPrivacidade/index.module.css'
import { termsConfig } from '../Termos/termsConfig'

// Política de Reembolso do PRO (LW.4.2): pública, sem login. Só a web (lançamento só web, 2026-10-10);
// reembolso de loja (Apple/Google) fica fora até o app voltar. Modelo, não parecer jurídico.
export function Reembolso() {
    const c = termsConfig

    return (
        <main className={styles.page}>
            <article className={styles.doc}>
                <Link to="/login" className={styles.back}>
                    <ArrowLeft size={16} aria-hidden="true" /> Voltar
                </Link>

                <header className={styles.header}>
                    <p className={styles.brand}>Selucra</p>
                    <h1 className={styles.title}>Política de Reembolso</h1>
                    <p className={styles.meta}>Última atualização: {c.lastUpdated}</p>
                </header>

                <p>
                    Esta política vale para a assinatura PRO contratada pelo site. Ela complementa os{' '}
                    <Link to="/termos">Termos de Uso e da Assinatura PRO</Link>.
                </p>

                <section className={styles.section}>
                    <h2>1. Desistência em {c.refundWindowDays}</h2>
                    <p>
                        Você pode desistir da assinatura em até <strong>{c.refundWindowDays}</strong> contados da contratação (do primeiro
                        pagamento), sem precisar dar motivo, e receber de volta <strong>o valor integral</strong>, conforme o art. 49 do
                        Código de Defesa do Consumidor.
                    </p>
                    <ul>
                        <li>Vale para a primeira contratação de cada plano, mensal ou anual.</li>
                        <li>O prazo não recomeça a cada renovação. Nas renovações, o caminho é o cancelamento (item 3).</li>
                        <li>Mesmo que você tenha usado as capacidades do PRO nesse período, o reembolso continua integral.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>2. Como pedir</h2>
                    <p>
                        Envie um e-mail para <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> com o e-mail da sua conta e a
                        informação de que deseja desistir. Respondemos em até {c.refundResponseTime}.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. Depois do prazo de desistência</h2>
                    <p>
                        Passado o prazo, não há reembolso do período já pago, mas você pode <strong>cancelar a qualquer momento</strong> em
                        &quot;Gerenciar assinatura&quot; (ou pedindo por e-mail) e manter o PRO até o fim do período pago, sem nova
                        cobrança.
                    </p>
                    <p>
                        Em caso de falha do serviço que impeça o uso do PRO por tempo relevante, avaliamos a devolução proporcional do
                        período afetado.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>4. Cobrança indevida ou duplicada</h2>
                    <p>
                        Se você foi cobrado por engano (cobrança em duplicidade, ou depois de cancelar dentro do prazo), devolvemos o valor
                        indevido integralmente.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>5. Como e quando o dinheiro volta</h2>
                    <p>
                        O reembolso é feito pelo Stripe, <strong>no mesmo cartão</strong> usado na compra. O prazo para aparecer na fatura
                        depende da operadora do cartão, normalmente de {c.refundCardTime}.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>6. O que acontece com a sua conta</h2>
                    <p>
                        Com o reembolso, o PRO é encerrado. <strong>Seu progresso não é apagado</strong>: XP, nível, conquistas e histórico
                        continuam na conta.
                    </p>
                </section>
            </article>
        </main>
    )
}
