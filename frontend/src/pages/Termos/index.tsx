import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from '../PoliticaPrivacidade/index.module.css'
import { termsConfig } from './termsConfig'

// Termos de Uso (LW.4.2): página pública, sem login. Identificação do fornecedor, objeto, conta, uso
// aceitável, propriedade intelectual, gratuidade, responsabilidade, mudanças e foro. É um modelo, não
// parecer jurídico. Os valores do autor vêm de `termsConfig`. Texto sem travessão (feedback do autor).
export function Termos() {
    const c = termsConfig

    return (
        <main className={styles.page}>
            <article className={styles.doc}>
                <Link to="/login" className={styles.back}>
                    <ArrowLeft size={16} aria-hidden="true" /> Voltar
                </Link>

                <header className={styles.header}>
                    <p className={styles.brand}>Selucra</p>
                    <h1 className={styles.title}>Termos de Uso</h1>
                    <p className={styles.meta}>Última atualização: {c.lastUpdated}</p>
                </header>

                <p>
                    Estes termos regulam o uso da plataforma Selucra. Ao criar uma conta, você declara que leu e concorda com eles. O
                    tratamento dos seus dados pessoais é explicado na <Link to="/privacidade">Política de Privacidade</Link>.
                </p>

                <section className={styles.section}>
                    <h2>1. Quem oferece</h2>
                    <p>
                        O Selucra é oferecido por <strong>{c.providerName}</strong>, {c.providerLegalForm}, com sede em {c.providerCity}.
                        Contato e suporte: <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>2. O que é o Selucra</h2>
                    <p>
                        O Selucra é uma plataforma educacional gamificada de educação financeira. Todas as operações são{' '}
                        <strong>simulações com dinheiro fictício e dados sintéticos</strong>. Não movimentamos dinheiro real, não somos
                        corretora, gestora nem consultoria, e <strong>nada no Selucra é recomendação de investimento</strong>.
                        Rentabilidades de simulação não indicam resultado futuro em mercados reais.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. Sua conta</h2>
                    <ul>
                        <li>A plataforma é destinada a maiores de {c.minimumAge} anos. Ao criar a conta, você declara ter essa idade.</li>
                        <li>Você deve informar dados verdadeiros, manter sua senha em sigilo e nos avisar se suspeitar de uso indevido.</li>
                        <li>Cada pessoa pode ter uma conta. A conta é pessoal e intransferível.</li>
                        <li>
                            Você pode excluir a conta quando quiser em Configurações. A exclusão segue o descrito na Política de
                            Privacidade.
                        </li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>4. Uso aceitável</h2>
                    <p>Não é permitido:</p>
                    <ul>
                        <li>criar contas falsas ou múltiplas para obter vantagem em ranking, votações, duelos, convites ou conquistas;</li>
                        <li>explorar falhas, automatizar o uso de forma abusiva ou tentar acessar dados de outras pessoas;</li>
                        <li>usar nome de usuário, foto ou textos ofensivos, discriminatórios ou que violem direitos de terceiros;</li>
                        <li>usar a plataforma para fins ilegais ou para se passar por outra pessoa.</li>
                    </ul>
                    <p>
                        Contas que descumprirem estas regras podem ser suspensas ou encerradas, e benefícios obtidos de forma indevida podem
                        ser desfeitos. Sempre que possível, avisamos o motivo por e-mail.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>5. Conteúdo e propriedade intelectual</h2>
                    <p>
                        O código, as lições, o design e a marca Selucra pertencem ao fornecedor ou a seus licenciantes. Você recebe um
                        direito pessoal, limitado e revogável de usar a plataforma, sem direito de copiar, revender ou criar obras
                        derivadas. O que você publica (como nome de usuário e foto de perfil) continua sendo seu, e você nos autoriza a
                        exibi-lo dentro da plataforma, como descrito na Política de Privacidade.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>6. Uso gratuito</h2>
                    <p>
                        <strong>O Selucra é gratuito.</strong> Não há plano pago, assinatura nem compra dentro da plataforma: lições, XP,
                        sequência, conquistas, mercado de simulação, ranking, ligas, duelos, cosméticos de perfil, retrospectivas e
                        Assembleias de Acionistas estão disponíveis para todas as contas, nas regras de cada recurso.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>7. Disponibilidade e limitação de responsabilidade</h2>
                    <p>
                        Trabalhamos para manter a plataforma disponível, mas ela pode ficar indisponível por manutenção, falhas de terceiros
                        ou motivos fora do nosso controle. Por ser uma ferramenta educacional com dados sintéticos, não nos
                        responsabilizamos por decisões financeiras reais tomadas com base no conteúdo. Nada nestes termos limita direitos
                        que a lei do consumidor garante a você.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>8. Alterações no serviço e nestes termos</h2>
                    <p>
                        Podemos ajustar, incluir ou retirar recursos da plataforma. Mudanças nestes termos serão comunicadas por e-mail e no
                        app antes de valerem.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>9. Lei aplicável e foro</h2>
                    <p>
                        Estes termos seguem a lei brasileira. Fica eleito o foro do domicílio do consumidor para resolver qualquer
                        controvérsia (Código de Defesa do Consumidor, art. 101, I).
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>10. Contato</h2>
                    <p>
                        Dúvidas sobre estes termos ou sobre a sua conta: <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>. Assuntos
                        de dados pessoais: <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>.
                    </p>
                </section>
            </article>
        </main>
    )
}
