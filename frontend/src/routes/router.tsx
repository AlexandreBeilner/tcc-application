import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { RequiresUnlock } from '../features/lessons/RequiresUnlock'
import { AdminShell } from '../components/templates/AdminShell'
import { AppShell } from '../components/templates/AppShell'
import { AuthCallback } from '../pages/AuthCallback'
import { Login } from '../pages/Login'
import { NotFound } from '../pages/NotFound'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — as rotas de auth (1.1, `/auth/callback`) e
// onboarding (1.2) ficam fora do shell. `/admin` ganha uma segunda camada
// de `<ProtectedRoute requireRole="admin">`: o item "Painel Administrativo"
// só aparece no menu do avatar pra `role=admin`, mas a rota em si precisa
// ser protegida de verdade, não só escondida via CSS (critério de aceite da
// tarefa 6.1). Dentro dela, `<AdminShell>` (N.3) dá a navegação por seções
// do painel: `/admin` é a Visão geral (10.1), `/admin/mercado` o monitor ao vivo (N.8), `/admin/eventos` o histórico de
// eventos macro e `/admin/eventos/novo` (10.2, tarefa 6.11) a criação — rotas
// irmãs, mesmo padrão de nesting de `/amigos/*`.
// LW.2.8: cada tela é um chunk próprio (`lazy`), carregado quando a rota é visitada; o bundle inicial
// leva só o shell, o login e o roteador. Os chunks entram no pré-cache do service worker, então a
// navegação continua rápida depois da primeira visita. Ficam fora do `lazy` só as telas de entrada
// pequenas (login, callback do Google e 404), para o primeiro desenho não esperar um segundo download.
export const router = createBrowserRouter([
    {
        path: '/login',
        element: <Login />,
    },
    // Recuperação de senha (EM.2.3): públicas, fora do shell. `/redefinir-senha` recebe o token
    // no fragmento (`#token=...`) do link do e-mail.
    {
        path: '/esqueci-senha',
        lazy: async () => ({ Component: (await import('../pages/EsqueciSenha')).EsqueciSenha }),
    },
    {
        path: '/redefinir-senha',
        lazy: async () => ({ Component: (await import('../pages/RedefinirSenha')).RedefinirSenha }),
    },
    // Verificação de e-mail (EM.3.3): pública, o token vem no fragmento do link.
    {
        path: '/verificar-email',
        lazy: async () => ({ Component: (await import('../pages/VerificarEmail')).VerificarEmail }),
    },
    // Cancelar inscrição de e-mail opcional (EM.6.1): pública, o token vem no fragmento do link.
    {
        path: '/cancelar-inscricao',
        lazy: async () => ({ Component: (await import('../pages/CancelarInscricao')).CancelarInscricao }),
    },
    {
        path: '/auth/callback',
        element: <AuthCallback />,
    },
    // Tarefa 4.2 (app mobile): política pública, sem login, a URL que vai
    // nos formulários da Google Play e da App Store.
    {
        path: '/privacidade',
        lazy: async () => ({ Component: (await import('../pages/PoliticaPrivacidade')).PoliticaPrivacidade }),
    },
    // LW.4.2: termos de uso e da assinatura PRO e política de reembolso, públicos como a privacidade.
    { path: '/termos', lazy: async () => ({ Component: (await import('../pages/Termos')).Termos }) },
    { path: '/reembolso', lazy: async () => ({ Component: (await import('../pages/Reembolso')).Reembolso }) },
    {
        element: <ProtectedRoute />,
        children: [
            // Irmã do shell, não filha: 1.2 é tela cheia, sem tab bar/top bar
            // (tarefa 6.2). <Onboarding> se auto-redireciona pra "/" se
            // `onboardingCompleted` já for `true`.
            { path: '/onboarding', lazy: async () => ({ Component: (await import('../pages/Onboarding')).Onboarding }) },
            {
                element: <AppShell />,
                children: [
                    // Portfólio/Calculadora só desbloqueiam de verdade depois de
                    // 0.1/0.2 (tarefa 7.0.1, achado 5) — `RequiresUnlock` renderiza
                    // `LockedGate` no lugar do conteúdo antes disso (Fase Q,
                    // "bloqueio é parede", nunca mais um redirect pra `/trilha`),
                    // mesmo padrão de nesting de `<ProtectedRoute requireRole="admin">`
                    // abaixo.
                    {
                        element: <RequiresUnlock unlockKey="portfolio" />,
                        children: [{ path: '/', lazy: async () => ({ Component: (await import('../pages/Portfolio')).Portfolio }) }],
                    },
                    // 3.1 Hub de trilhas (tarefa 6.4, redesenhado na O.1) e 3.2 Lição
                    // — `/trilha/:id` é rota irmã, não filha de `/trilha`, já que a
                    // Lição ocupa a tela inteira dentro do mesmo <AppShell> (sem
                    // navegação aninhada nova). `/trilha/mapa/:trackNumber` (mapa
                    // vertical por trilha, O.3) tem segmento estático (`mapa`) próprio
                    // pra nunca colidir com `/trilha/:id` (UUID) — `trackNumber`
                    // inválido/fora do currículo redireciona pro Hub.
                    { path: '/trilha', lazy: async () => ({ Component: (await import('../pages/TrilhasHub')).TrilhasHub }) },
                    // Consulta do glossário das lições (RC.3.5): sempre aberta, não é produto travado.
                    { path: '/glossario', lazy: async () => ({ Component: (await import('../pages/Glossario')).Glossario }) },
                    { path: '/trilha/mapa/:trackNumber', lazy: async () => ({ Component: (await import('../pages/TrackMap')).TrackMap }) },
                    // Revisão de 1 minuto (LJ.5.6): segmento estático, nunca colide com `/trilha/:id`.
                    { path: '/trilha/revisao', lazy: async () => ({ Component: (await import('../pages/RevisaoRapida')).RevisaoRapida }) },
                    { path: '/trilha/:id', lazy: async () => ({ Component: (await import('../pages/Lesson')).Lesson }) },
                    // Tela 4.1 (hub) + 4.2/4.3 (Renda Fixa) + 4.4/4.5/4.6 (Renda
                    // Variável) + 4.7 (Confirmação de Ordem, tarefa 6.5). 4.7 não é
                    // rota própria: é `OrderConfirmationDialog`, overlay renderizado
                    // por `AssetDetail`/`FixedIncomeDetail` sobre a própria tela de
                    // origem (identidade-visual-padroes.md §7 — bottom sheet/modal).
                    // Plano PRO (MO.3.1): sempre aberta, é a vitrine da assinatura, não produto travado.
                    { path: '/planos', lazy: async () => ({ Component: (await import('../pages/Planos')).Planos }) },
                    { path: '/mercado', lazy: async () => ({ Component: (await import('../pages/Market')).Market }) },
                    {
                        path: '/mercado/renda-fixa',
                        lazy: async () => ({ Component: (await import('../pages/FixedIncomeList')).FixedIncomeList }),
                    },
                    {
                        path: '/mercado/renda-fixa/:id',
                        lazy: async () => ({ Component: (await import('../pages/FixedIncomeDetail')).FixedIncomeDetail }),
                    },
                    {
                        path: '/mercado/renda-variavel',
                        lazy: async () => ({ Component: (await import('../pages/EquityList')).EquityList }),
                    },
                    { path: '/mercado/ativos/:id', lazy: async () => ({ Component: (await import('../pages/AssetDetail')).AssetDetail }) },
                    {
                        path: '/mercado/empresas/:id',
                        lazy: async () => ({ Component: (await import('../pages/CompanyProfile')).CompanyProfile }),
                    },
                    // 4.9 Indicadores Econômicos (tarefa M.4) — irmã de
                    // `/mercado/*`, não desbloqueada pela trilha (mesmo
                    // tratamento do hub 4.1, dado informativo, não produto).
                    {
                        path: '/mercado/indicadores',
                        lazy: async () => ({ Component: (await import('../pages/IndicadoresEconomicos')).IndicadoresEconomicos }),
                    },
                    // 4.10 Minhas Ordens (tarefa O.4) — irmã de `/mercado/*`,
                    // mesmo tratamento de 4.9: lista as próprias ordens do
                    // usuário, não é produto travado pela trilha.
                    { path: '/mercado/ordens', lazy: async () => ({ Component: (await import('../pages/MinhasOrdens')).MinhasOrdens }) },
                    {
                        element: <RequiresUnlock unlockKey="calculator" />,
                        children: [
                            { path: '/calculadora', lazy: async () => ({ Component: (await import('../pages/Calculator')).Calculator }) },
                        ],
                    },
                    { path: '/classificacao', lazy: async () => ({ Component: (await import('../pages/Classificacao')).Classificacao }) },
                    // Indicação entre amigos (MO.7.2): qualquer pessoa convida por link.
                    { path: '/convidar', lazy: async () => ({ Component: (await import('../pages/Convidar')).Convidar }) },
                    // Ligas privadas do PRO (MO.5.2c): participar é de graça, criar é PRO.
                    { path: '/ligas', lazy: async () => ({ Component: (await import('../pages/Ligas')).Ligas }) },
                    { path: '/ligas/:id', lazy: async () => ({ Component: (await import('../pages/LigaDetalhe')).LigaDetalhe }) },
                    // Duelos entre amigos (MO.5.3): aceitar é de graça, desafiar é PRO.
                    { path: '/duelos', lazy: async () => ({ Component: (await import('../pages/Duelos')).Duelos }) },
                    // Assembleia de Acionistas (MO.6.6): leitura pública, voto nas regras do servidor.
                    { path: '/assembleias', lazy: async () => ({ Component: (await import('../pages/Assembleias')).Assembleias }) },
                    {
                        path: '/assembleias/:id',
                        lazy: async () => ({ Component: (await import('../pages/AssembleiaDetalhe')).AssembleiaDetalhe }),
                    },
                    // Retrospectiva mensal (MO.5.4): versão simples para todos, completa no PRO.
                    { path: '/retrospectiva', lazy: async () => ({ Component: (await import('../pages/Retrospectiva')).Retrospectiva }) },
                    { path: '/duelos/:id', lazy: async () => ({ Component: (await import('../pages/DuelDetalhe')).DuelDetalhe }) },
                    // Notícias só desbloqueia de verdade na lição que libera
                    // `news_feed` (Fase Q, reversão da decisão original de
                    // 7.0.1 de tratar o feed como "sempre acessível, só
                    // aviso") — mesmo gate real de Portfólio/Calculadora.
                    {
                        element: <RequiresUnlock unlockKey="news_feed" />,
                        children: [{ path: '/noticias', lazy: async () => ({ Component: (await import('../pages/News')).News }) }],
                    },
                    // Destino do clique no card de patrimônio (tela 2.1, tarefa 6.3)
                    // — conteúdo real (4.8 Extrato, tarefa 6.5).
                    { path: '/extrato', lazy: async () => ({ Component: (await import('../pages/Statement')).Statement }) },
                    // Meus ativos (MO.8.3): posições com rendimento desde a compra; fora da barra principal.
                    { path: '/ativos', lazy: async () => ({ Component: (await import('../pages/MyAssets')).MyAssets }) },
                    { path: '/perfil', lazy: async () => ({ Component: (await import('../pages/MeuPerfil')).MeuPerfil }) },
                    // Tarefa 6.9 — 8.1 (hub) + 8.2 (buscar) + 8.3
                    // (solicitações). `/perfil/:id` é rota irmã de `/perfil`
                    // (self, 9.1 "Meu Perfil", tarefa 6.10): 8.4 "Perfil
                    // Público de Outro Usuário" é acessada tanto daqui quanto
                    // da Classificação (7.1, `RankingBoard`).
                    { path: '/amigos', lazy: async () => ({ Component: (await import('../pages/Amigos')).Amigos }) },
                    { path: '/amigos/buscar', lazy: async () => ({ Component: (await import('../pages/BuscarAmigos')).BuscarAmigos }) },
                    {
                        path: '/amigos/solicitacoes',
                        lazy: async () => ({ Component: (await import('../pages/SolicitacoesAmizade')).SolicitacoesAmizade }),
                    },
                    { path: '/perfil/:id', lazy: async () => ({ Component: (await import('../pages/PerfilPublico')).PerfilPublico }) },
                    { path: '/conquistas', lazy: async () => ({ Component: (await import('../pages/Conquistas')).Conquistas }) },
                    // 9.2 Configurações de Conta (tarefa 6.10). `/configuracoes/privacidade`
                    // é rota irmã (9.3 Privacidade e LGPD, acessada a partir de 9.2,
                    // inventário) — mesmo padrão de nesting de `/amigos/*`.
                    { path: '/configuracoes', lazy: async () => ({ Component: (await import('../pages/Configuracoes')).Configuracoes }) },
                    {
                        path: '/configuracoes/privacidade',
                        lazy: async () => ({ Component: (await import('../pages/PrivacidadeLgpd')).PrivacidadeLgpd }),
                    },
                    {
                        element: <ProtectedRoute requireRole="admin" />,
                        children: [
                            {
                                element: <AdminShell />,
                                children: [
                                    {
                                        path: '/admin',
                                        lazy: async () => ({ Component: (await import('../pages/AdminVisaoGeral')).AdminVisaoGeral }),
                                    },
                                    {
                                        path: '/admin/eventos',
                                        lazy: async () => ({ Component: (await import('../pages/AdminEventosMacro')).AdminEventosMacro }),
                                    },
                                    {
                                        path: '/admin/eventos/:id',
                                        lazy: async () => ({
                                            Component: (await import('../pages/AdminEventoMacroDetalhe')).AdminEventoMacroDetalhe,
                                        }),
                                    },
                                    {
                                        path: '/admin/tempo',
                                        lazy: async () => ({ Component: (await import('../pages/AdminTempo')).AdminTempo }),
                                    },
                                    {
                                        path: '/admin/tempo/parametros',
                                        lazy: async () => ({ Component: (await import('../pages/AdminParametros')).AdminParametros }),
                                    },
                                    {
                                        path: '/admin/mercado',
                                        lazy: async () => ({ Component: (await import('../pages/AdminMercado')).AdminMercado }),
                                    },
                                    {
                                        path: '/admin/mercado/ativos/:id',
                                        lazy: async () => ({ Component: (await import('../pages/AdminMercadoAtivo')).AdminMercadoAtivo }),
                                    },
                                    {
                                        path: '/admin/mercado/catalogo',
                                        lazy: async () => ({ Component: (await import('../pages/AdminCatalogo')).AdminCatalogo }),
                                    },
                                    {
                                        path: '/admin/mercado/ordens',
                                        lazy: async () => ({ Component: (await import('../pages/AdminOrdens')).AdminOrdens }),
                                    },
                                    {
                                        path: '/admin/mercado/pausas',
                                        lazy: async () => ({ Component: (await import('../pages/AdminPausas')).AdminPausas }),
                                    },
                                    {
                                        path: '/admin/bots',
                                        lazy: async () => ({ Component: (await import('../pages/AdminBots')).AdminBots }),
                                    },
                                    {
                                        path: '/admin/conteudo',
                                        lazy: async () => ({ Component: (await import('../pages/AdminConteudo')).AdminConteudo }),
                                    },
                                    {
                                        path: '/admin/conteudo/nova',
                                        lazy: async () => ({ Component: (await import('../pages/AdminConteudoNova')).AdminConteudoNova }),
                                    },
                                    {
                                        path: '/admin/conteudo/:id/funil',
                                        lazy: async () => ({ Component: (await import('../pages/AdminConteudoFunil')).AdminConteudoFunil }),
                                    },
                                    {
                                        path: '/admin/conteudo/:id',
                                        lazy: async () => ({ Component: (await import('../pages/AdminConteudoLicao')).AdminConteudoLicao }),
                                    },
                                    {
                                        path: '/admin/gamificacao',
                                        lazy: async () => ({ Component: (await import('../pages/AdminGamificacao')).AdminGamificacao }),
                                    },
                                    {
                                        path: '/admin/assinaturas',
                                        lazy: async () => ({ Component: (await import('../pages/AdminAssinaturas')).AdminAssinaturas }),
                                    },
                                    {
                                        path: '/admin/assembleias',
                                        lazy: async () => ({ Component: (await import('../pages/AdminAssembleias')).AdminAssembleias }),
                                    },
                                    {
                                        path: '/admin/assembleias/parametros',
                                        lazy: async () => ({
                                            Component: (await import('../pages/AdminAssembleiaParametros')).AdminAssembleiaParametros,
                                        }),
                                    },
                                    {
                                        path: '/admin/assembleias/pautas',
                                        lazy: async () => ({
                                            Component: (await import('../pages/AdminAssembleiaPautas')).AdminAssembleiaPautas,
                                        }),
                                    },
                                    {
                                        path: '/admin/assembleias/:id',
                                        lazy: async () => ({
                                            Component: (await import('../pages/AdminAssembleiaDetalhe')).AdminAssembleiaDetalhe,
                                        }),
                                    },
                                    {
                                        path: '/admin/sistema',
                                        lazy: async () => ({ Component: (await import('../pages/AdminSistema')).AdminSistema }),
                                    },
                                    {
                                        path: '/admin/usuarios',
                                        lazy: async () => ({ Component: (await import('../pages/AdminUsuarios')).AdminUsuarios }),
                                    },
                                    {
                                        path: '/admin/usuarios/:id',
                                        lazy: async () => ({
                                            Component: (await import('../pages/AdminUsuarioDetalhe')).AdminUsuarioDetalhe,
                                        }),
                                    },
                                    {
                                        path: '/admin/auditoria',
                                        lazy: async () => ({ Component: (await import('../pages/AdminAuditoria')).AdminAuditoria }),
                                    },
                                    {
                                        path: '/admin/eventos/novo',
                                        lazy: async () => ({ Component: (await import('../pages/CriarEventoMacro')).CriarEventoMacro }),
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    { path: '*', element: <NotFound /> },
])
