import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from '../PoliticaPrivacidade/index.module.css'
import { termsConfig } from './termsConfig'

// Termos de Uso e da Assinatura PRO (LW.4.2): página pública, sem login. Estrutura de mercado para
// serviço digital por assinatura no Brasil: identificação do fornecedor, objeto, conta, uso aceitável,
// planos e preço, renovação, cancelamento, arrependimento (CDC art. 49), o que acontece ao fim,
// responsabilidade, mudanças e foro. É um modelo, não parecer jurídico: revisão por advogado antes de
// cobrar de verdade. Os valores do autor vêm de `termsConfig`. Texto sem travessão (feedback do autor).
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
                    <h1 className={styles.title}>Termos de Uso e da Assinatura PRO</h1>
                    <p className={styles.meta}>Última atualização: {c.lastUpdated}</p>
                </header>

                <p>
                    Estes termos regulam o uso da plataforma Selucra e a contratação do plano PRO. Ao criar uma conta ou contratar o PRO,
                    você declara que leu e concorda com eles. O tratamento dos seus dados pessoais é explicado na{' '}
                    <Link to="/privacidade">Política de Privacidade</Link>, e a devolução de valores na{' '}
                    <Link to="/reembolso">Política de Reembolso</Link>.
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
                        corretora, gestora nem consultoria, e <strong>nada na plataforma é recomendação de investimento</strong>.
                        Rentabilidades simuladas não indicam resultado futuro em mercados reais.
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
                        <li>criar contas falsas ou múltiplas para obter vantagem em ranking, votações, duelos ou benefícios;</li>
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
                    <h2>6. O plano gratuito e o PRO</h2>
                    <p>
                        O PRO é uma assinatura opcional que libera capacidades extras de participação e de identidade, como ligas privadas
                        com amigos, duelos, cosméticos de perfil, retrospectiva compartilhável e voz plena nas Assembleias de Acionistas. As
                        capacidades vigentes são as listadas na página de planos no momento da contratação.
                    </p>
                    <p>
                        <strong>O PRO nunca é necessário para aprender nem para jogar o essencial.</strong> Lições da trilha, XP, sequência,
                        conquistas, compra e venda no mercado simulado e o ranking oficial continuam gratuitos. Não usamos contagem
                        regressiva nem escassez artificial para forçar a assinatura.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>7. Planos, preço e pagamento</h2>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Plano</th>
                                    <th>Preço</th>
                                    <th>Cobrança</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td data-label="Plano">Mensal</td>
                                    <td data-label="Preço">{c.monthlyPrice}</td>
                                    <td data-label="Cobrança">a cada mês</td>
                                </tr>
                                <tr>
                                    <td data-label="Plano">Anual</td>
                                    <td data-label="Preço">{c.annualPrice}</td>
                                    <td data-label="Cobrança">a cada ano</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p>
                        Os preços são em reais e já incluem os tributos aplicáveis. Não há período de teste gratuito. O pagamento é feito
                        somente por cartão, em cobrança recorrente, em ambiente seguro operado pelo Stripe. O Selucra não recebe nem guarda
                        os dados do seu cartão. A gestão da assinatura usa o RevenueCat, que recebe do Stripe a confirmação do pagamento.
                    </p>
                    <p>
                        Reajustes só valem a partir da renovação seguinte e são avisados por e-mail com pelo menos {c.priceChangeNoticeDays}{' '}
                        de antecedência. Se não concordar, é só cancelar antes da renovação.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>8. Renovação automática</h2>
                    <p>
                        A assinatura <strong>renova automaticamente</strong> ao fim de cada período (mês ou ano), pelo mesmo plano e pelo
                        preço vigente, até que você a cancele. Se a cobrança falhar, o Stripe tenta novamente por alguns dias e avisamos
                        você por e-mail; sem sucesso, a assinatura é encerrada.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>9. Cancelamento</h2>
                    <p>
                        Você cancela quando quiser, em &quot;Gerenciar assinatura&quot; (nas configurações do plano), sem multa. Se o botão
                        não aparecer, peça o cancelamento por e-mail para <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>e
                        cancelamos para você. O cancelamento vale para a <strong>próxima</strong> renovação: você mantém o PRO até o fim do
                        período já pago, e nenhuma nova cobrança é feita.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>10. Direito de arrependimento</h2>
                    <p>
                        Como a contratação é feita pela internet, você pode desistir em até <strong>{c.refundWindowDays}</strong> a contar
                        da contratação e receber de volta o valor integral, conforme o art. 49 do Código de Defesa do Consumidor. Os
                        detalhes e como pedir estão na <Link to="/reembolso">Política de Reembolso</Link>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>11. Quando a assinatura termina</h2>
                    <p>
                        <strong>Cancelar nunca apaga o que você conquistou.</strong> XP, nível, conquistas, lições, histórico de mercado,
                        ligas e duelos que você criou, cosméticos que você tinha e retrospectivas ficam guardados e apenas inativos. Se
                        assinar de novo, voltam como estavam.
                    </p>
                    <p>
                        Ao fim do período pago, ficam em pausa só as capacidades que dependem de assinatura ativa, como criar liga ou duelo,
                        equipar cosmético, propor pauta nas Assembleias e votar além do crédito gratuito mensal.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>12. Disponibilidade e limitação de responsabilidade</h2>
                    <p>
                        Trabalhamos para manter a plataforma disponível, mas ela pode ficar indisponível por manutenção, falhas de terceiros
                        ou motivos fora do nosso controle. Por ser uma ferramenta educacional com dados simulados, não nos responsabilizamos
                        por decisões financeiras reais tomadas com base no conteúdo. Nada nestes termos limita direitos que a lei do
                        consumidor garante a você.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>13. Alterações no serviço e nestes termos</h2>
                    <p>
                        Podemos ajustar, incluir ou retirar capacidades do PRO. Se uma capacidade que você contratou deixar de existir de
                        forma relevante, você pode cancelar e pedir a devolução proporcional ao período não aproveitado. Mudanças nestes
                        termos serão comunicadas por e-mail e no app antes de valerem e, para quem já assina, só se aplicam a partir da
                        renovação seguinte.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>14. Lei aplicável e foro</h2>
                    <p>
                        Estes termos seguem a lei brasileira. Fica eleito o foro do domicílio do consumidor para resolver qualquer
                        controvérsia (Código de Defesa do Consumidor, art. 101, I).
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>15. Contato</h2>
                    <p>
                        Dúvidas sobre estes termos ou sobre a sua assinatura: <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>.
                        Assuntos de dados pessoais: <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>.
                    </p>
                </section>
            </article>
        </main>
    )
}
