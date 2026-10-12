import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { policyConfig } from './policyConfig'
import styles from './index.module.css'

// Tarefa 4.2 do backlog de app mobile: política de privacidade pública
// (sem login), exigida pela Google Play e pela App Store como URL. Estrutura
// segue o padrão de mercado pra LGPD (art. 9º): quem trata, quais dados,
// finalidade e base legal, compartilhamento, retenção, direitos do titular e
// contato. O que depende de dados do autor vem de `policyConfig`.
//
// Texto de UI sem travessão (feedback do autor): nada de "—" como pontuação.
const DATA_ROWS = [
    {
        data: 'Nome, e-mail e nome de usuário',
        purpose: 'Criar e identificar sua conta, e mostrar você a outros usuários (nome e nome de usuário).',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Senha (guardada só como hash irreversível)',
        purpose: 'Autenticar você quando entra com e-mail e senha. Nunca guardamos a senha em texto.',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Identificador e e-mail da conta Google',
        purpose: 'Permitir o login com Google. Não recebemos a senha do Google nem acesso aos seus contatos ou e-mails.',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Foto de perfil (opcional)',
        purpose: 'Exibir seu avatar no app e para outros usuários.',
        basis: 'Consentimento (art. 7º, I)',
    },
    {
        data: 'Progresso, XP, nível, conquistas, sequência de dias e missões',
        purpose: 'Funcionamento da trilha de lições e da gamificação.',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Ordens, carteira e extrato da simulação',
        purpose: 'Calcular a sua carteira e a rentabilidade mostrada no ranking. São dados fictícios.',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Amizades e solicitações',
        purpose: 'Ranking entre amigos e perfil público.',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Plano PRO: plano contratado, datas de início e renovação, situação da assinatura e identificador da assinatura',
        purpose: 'Liberar e encerrar as capacidades do PRO e cobrar corretamente.',
        basis: 'Execução do contrato (art. 7º, V)',
    },
    {
        data: 'Pagamento: valor e data de cada cobrança, final do cartão e bandeira (nunca o número completo)',
        purpose: 'Mostrar o histórico, atender pedidos de reembolso e cumprir obrigações fiscais e contábeis.',
        basis: 'Execução do contrato (art. 7º, V) e obrigação legal (art. 7º, II)',
    },
    {
        data: 'E-mails que enviamos para você (recuperação de senha, verificação, avisos de segurança e da assinatura e, só se você ligar, avisos sociais e de engajamento)',
        purpose: 'Operar a conta com segurança e, se você pedir, manter você informado. Você desliga os opcionais em Configurações.',
        basis: 'Execução do contrato (art. 7º, V) e consentimento (art. 7º, I) para os opcionais',
    },
    {
        data: 'Passos de contato com o plano PRO (viu um convite, abriu a página de planos, iniciou a compra, assinou ou cancelou, com o ponto do app de onde veio)',
        purpose:
            'Entender quais convites ao PRO funcionam e melhorar a oferta. Medimos por conta própria, sem ferramenta de terceiro, e nenhum desses registros leva valor em reais nem patrimônio.',
        basis: 'Legítimo interesse (art. 7º, IX)',
    },
    {
        data: 'Registros técnicos (endereço IP, data e hora de acesso, erros)',
        purpose: 'Segurança, prevenção a abuso e correção de falhas.',
        basis: 'Legítimo interesse (art. 7º, IX) e obrigação legal (Marco Civil da Internet, art. 15)',
    },
]

export function PoliticaPrivacidade() {
    const c = policyConfig

    return (
        <main className={styles.page}>
            <article className={styles.doc}>
                <Link to="/login" className={styles.back}>
                    <ArrowLeft size={16} aria-hidden="true" /> Voltar
                </Link>

                <header className={styles.header}>
                    <p className={styles.brand}>Selucra</p>
                    <h1 className={styles.title}>Política de Privacidade</h1>
                    <p className={styles.meta}>Última atualização: {c.lastUpdated}</p>
                </header>

                <p>
                    Esta política explica quais dados pessoais a plataforma Selucra coleta, para que usa, com quem compartilha e quais são
                    os seus direitos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD).
                </p>

                <section className={styles.section}>
                    <h2>1. Quem somos</h2>
                    <p>
                        O controlador dos dados pessoais tratados pela plataforma é <strong>{c.controllerName}</strong>. O encarregado pelo
                        tratamento de dados (DPO) é <strong>{c.dpoName}</strong>, e o canal para falar sobre privacidade é{' '}
                        <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>2. O que é a plataforma</h2>
                    <p>
                        O Selucra é uma plataforma educacional gamificada de educação financeira. Todas as operações de investimento são{' '}
                        <strong>simulações com dinheiro fictício e dados sintéticos</strong>. Não movimentamos dinheiro real, não somos
                        corretora e nada aqui é recomendação de investimento.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. Dados que coletamos, para quê e em que base legal</h2>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th scope="col">Dado</th>
                                    <th scope="col">Finalidade</th>
                                    <th scope="col">Base legal (LGPD)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DATA_ROWS.map((row) => (
                                    <tr key={row.data}>
                                        <td data-label="Dado">{row.data}</td>
                                        <td data-label="Finalidade">{row.purpose}</td>
                                        <td data-label="Base legal">{row.basis}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className={styles.section}>
                    <h2>4. Dados que não coletamos</h2>
                    <p>
                        Não pedimos CPF, documentos, localização, contatos do telefone, câmera ou microfone. Os dados do cartão, quando você
                        assina o PRO, são digitados direto no ambiente de pagamento do Stripe e nunca passam pelos nossos servidores. Não
                        coletamos dados pessoais sensíveis (art. 5º, II da LGPD).
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>5. Compartilhamento</h2>
                    <p>Não vendemos seus dados e não os usamos para publicidade. O compartilhamento acontece só nestes casos:</p>
                    <ul>
                        <li>
                            <strong>Com outros usuários:</strong> seu nome, nome de usuário, foto, nível, conquistas e rentabilidade
                            percentual aparecem no ranking e no perfil público. O valor absoluto do seu patrimônio nunca é mostrado a outros
                            usuários.
                        </li>
                        <li>
                            <strong>Com o Google:</strong> se você escolher entrar com Google, o login é feito pelo Google, sujeito à
                            política de privacidade dele.
                        </li>
                        <li>
                            <strong>Com o Stripe (pagamento):</strong> quando você assina o PRO, o pagamento é processado pelo Stripe, que
                            recebe o e-mail e os dados do cartão que você informar na hora. O Stripe pode atuar também como controlador
                            independente para prevenção a fraudes e cumprimento de suas obrigações legais, conforme a política de
                            privacidade dele.
                        </li>
                        <li>
                            <strong>Com o RevenueCat (gestão da assinatura):</strong> ele recebe um identificador da sua conta no Selucra,
                            os dados do plano e os eventos da assinatura enviados pelo Stripe, para sabermos se o seu PRO está ativo.
                        </li>
                        <li>
                            <strong>Com o Resend (e-mail):</strong> para enviar os e-mails da plataforma, ele recebe o seu endereço de
                            e-mail e o conteúdo de cada mensagem, como operador.
                        </li>
                        <li>
                            <strong>Com a Cloudflare (rede e proteção):</strong> o tráfego do site e da API passa pela Cloudflare, que
                            entrega as páginas, filtra acessos abusivos e mede as visitas do site de apresentação, como operador.
                        </li>
                        <li>
                            <strong>Com o provedor de hospedagem ({c.hostingProvider}):</strong> ele guarda os dados nos servidores, em{' '}
                            {c.hostingCountry}, como operador, seguindo nossas instruções.
                        </li>
                        <li>
                            <strong>Com o provedor das cópias de segurança:</strong> cópias criptografadas do banco de dados ficam em um
                            armazenamento de nuvem separado do servidor, como operador. Dados excluídos deixam de existir nessas cópias
                            quando elas vencem, no ciclo de retenção delas.
                        </li>
                        <li>
                            <strong>Transferência internacional:</strong> Stripe, RevenueCat, Resend e Cloudflare tratam dados também fora
                            do Brasil, inclusive nos Estados Unidos, e o provedor das cópias de segurança pode fazer o mesmo. Essas
                            transferências seguem o art. 33 da LGPD, com as garantias contratuais oferecidas por cada empresa.
                        </li>
                        <li>
                            <strong>Por obrigação legal:</strong> quando uma autoridade competente exigir por ordem judicial ou determinação
                            legal.
                        </li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>6. Cookies e armazenamento no dispositivo</h2>
                    <p>
                        No aplicativo, não usamos cookies de rastreamento nem ferramentas de analytics ou publicidade de terceiros.
                        Guardamos no seu dispositivo apenas o necessário para manter você conectado (o token de sessão) e para lembrar
                        preferências como o tema. As fontes de letra são servidas pelo próprio aplicativo, sem chamada a serviços de
                        terceiros.
                    </p>
                    <p>
                        Se você instalar o aplicativo na tela inicial do celular ou do computador, o navegador guarda no aparelho apenas os
                        arquivos do próprio aplicativo (telas, fontes e ícones), para abrir mais rápido e mostrar um aviso quando não houver
                        internet. Dados da sua conta, do mercado e da sua carteira nunca ficam guardados nesses arquivos.
                    </p>
                    <p>
                        No site de apresentação (selucra.com.br), usamos o Cloudflare Web Analytics para contar visitas e medir o desempenho
                        das páginas. Ele não usa cookies nem cria perfil de cada visitante.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>7. Por quanto tempo guardamos</h2>
                    <p>
                        Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir a conta, seus dados pessoais (nome, e-mail, nome de
                        usuário, senha, foto e vínculo com o Google) são anonimizados e você deixa de conseguir entrar. O histórico fictício
                        de operações e do ranking permanece sem identificar você, porque faz parte de um registro imutável do mercado. Os
                        registros de contato com o plano PRO são apagados depois de 12 meses e, se você excluir a conta antes, ficam sem
                        nenhum dado que identifique você. Dados de assinatura e de cobrança ficam guardados pelo prazo exigido pela lei
                        fiscal e contábil, em geral 5 anos, mesmo depois de excluir a conta. Registros técnicos de acesso são mantidos pelo
                        prazo mínimo exigido em lei.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>8. Segurança</h2>
                    <p>
                        Usamos conexão criptografada (HTTPS), senhas armazenadas com hash, controle de acesso por perfil e sessões que podem
                        ser encerradas. Nenhum sistema é totalmente imune a falhas; se houver incidente que possa causar risco relevante a
                        você, comunicaremos você e a Autoridade Nacional de Proteção de Dados, conforme o art. 48 da LGPD.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>9. Seus direitos</h2>
                    <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
                    <ul>
                        <li>confirmar se tratamos seus dados e acessá-los;</li>
                        <li>corrigir dados incompletos ou desatualizados;</li>
                        <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                        <li>pedir a portabilidade dos seus dados;</li>
                        <li>revogar consentimentos e ser informado sobre as consequências;</li>
                        <li>se opor a um tratamento feito sem consentimento, quando houver descumprimento da lei.</li>
                    </ul>
                    <p>
                        Dentro do app, em <strong>Configurações &gt; Privacidade e LGPD</strong>, você exporta seus dados e exclui sua conta
                        sozinho. Para qualquer outro pedido, escreva para <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>.
                        Respondemos em até {c.responseDeadline}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados
                        (gov.br/anpd).
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>10. Crianças e adolescentes</h2>
                    <p>
                        A plataforma é destinada a maiores de {c.minimumAge} anos e não coleta dados de menores de propósito. Se soubermos
                        que uma conta pertence a alguém abaixo dessa idade, sem a autorização de um responsável legal (LGPD, art. 14),
                        excluímos a conta.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>11. Alterações desta política</h2>
                    <p>
                        Podemos atualizar esta política. A data no topo mostra a última versão e, em mudanças relevantes, avisaremos no app
                        antes de elas valerem.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>12. Contato</h2>
                    <p>
                        Dúvidas sobre esta política ou sobre seus dados: <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>.
                    </p>
                </section>
            </article>
        </main>
    )
}
