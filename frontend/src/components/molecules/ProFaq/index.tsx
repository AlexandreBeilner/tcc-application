import { Link } from 'react-router-dom'
import styles from './index.module.css'

// Perguntas curtas da /planos (MO.9.9). Respostas conferidas com Termos e Política de Reembolso
// (7 dias corridos, valor integral, cancelamento em Configurações, progresso preservado).
export function ProFaq() {
    return (
        <section className={styles.section} aria-labelledby="pro-faq-title">
            <h2 id="pro-faq-title" className={styles.title}>
                Perguntas rápidas
            </h2>
            <div className={styles.list}>
                <details className={styles.item}>
                    <summary className={styles.question}>Renova sozinho?</summary>
                    <p className={styles.answer}>Sim, a cada mês ou ano, até você cancelar.</p>
                </details>
                <details className={styles.item}>
                    <summary className={styles.question}>Como cancelo?</summary>
                    <p className={styles.answer}>
                        Em <Link to="/configuracoes">Configurações</Link>, em Gerenciar plano, sem multa. O PRO vale até o fim do período
                        pago.
                    </p>
                </details>
                <details className={styles.item}>
                    <summary className={styles.question}>O que acontece com meu progresso se eu sair?</summary>
                    <p className={styles.answer}>
                        Nada é apagado: XP, nível, conquistas, ligas e histórico ficam na conta. Só as vantagens PRO ficam em pausa.
                    </p>
                </details>
                <details className={styles.item}>
                    <summary className={styles.question}>Posso desistir depois de assinar?</summary>
                    <p className={styles.answer}>
                        Pode, em até 7 dias, e recebe o valor integral. Veja a <Link to="/reembolso">Política de Reembolso</Link>.
                    </p>
                </details>
            </div>
        </section>
    )
}
