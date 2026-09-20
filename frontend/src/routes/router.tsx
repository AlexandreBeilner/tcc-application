import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { RequiresUnlock } from '../features/lessons/RequiresUnlock'
import { AppShell } from '../components/templates/AppShell'
import { Amigos } from '../pages/Amigos'
import { AssetDetail } from '../pages/AssetDetail'
import { AuthCallback } from '../pages/AuthCallback'
import { BuscarAmigos } from '../pages/BuscarAmigos'
import { Calculator } from '../pages/Calculator'
import { Classificacao } from '../pages/Classificacao'
import { CompanyProfile } from '../pages/CompanyProfile'
import { Configuracoes } from '../pages/Configuracoes'
import { Conquistas } from '../pages/Conquistas'
import { CriarEventoMacro } from '../pages/CriarEventoMacro'
import { EquityList } from '../pages/EquityList'
import { FixedIncomeDetail } from '../pages/FixedIncomeDetail'
import { FixedIncomeList } from '../pages/FixedIncomeList'
import { IndicadoresEconomicos } from '../pages/IndicadoresEconomicos'
import { Lesson } from '../pages/Lesson'
import { Login } from '../pages/Login'
import { Market } from '../pages/Market'
import { MeuPerfil } from '../pages/MeuPerfil'
import { News } from '../pages/News'
import { Onboarding } from '../pages/Onboarding'
import { PainelAdmin } from '../pages/PainelAdmin'
import { PerfilPublico } from '../pages/PerfilPublico'
import { Portfolio } from '../pages/Portfolio'
import { PrivacidadeLgpd } from '../pages/PrivacidadeLgpd'
import { SolicitacoesAmizade } from '../pages/SolicitacoesAmizade'
import { Statement } from '../pages/Statement'
import { TrackMap } from '../pages/TrackMap'
import { TrilhasHub } from '../pages/TrilhasHub'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — as rotas de auth (1.1, `/auth/callback`) e
// onboarding (1.2) ficam fora do shell. `/admin` ganha uma segunda camada
// de `<ProtectedRoute requireRole="admin">`: o item "Painel Administrativo"
// só aparece no menu do avatar pra `role=admin`, mas a rota em si precisa
// ser protegida de verdade, não só escondida via CSS (critério de aceite da
// tarefa 6.1). `/admin/eventos/novo` (10.2, tarefa 6.11) é rota irmã de
// `/admin` (10.1), não filha — mesmo padrão de nesting de `/amigos/*`.
export const router = createBrowserRouter([
    {
        path: '/login',
        element: <Login />,
    },
    {
        path: '/auth/callback',
        element: <AuthCallback />,
    },
    {
        element: <ProtectedRoute />,
        children: [
            // Irmã do shell, não filha: 1.2 é tela cheia, sem tab bar/top bar
            // (tarefa 6.2). <Onboarding> se auto-redireciona pra "/" se
            // `onboardingCompleted` já for `true`.
            { path: '/onboarding', element: <Onboarding /> },
            {
                element: <AppShell />,
                children: [
                    // Portfólio/Calculadora só desbloqueiam de verdade depois de
                    // 0.1/0.2 (tarefa 7.0.1, achado 5) — `RequiresUnlock` renderiza
                    // `LockedScreen` no lugar do conteúdo antes disso (Fase Q,
                    // "bloqueio é parede", nunca mais um redirect pra `/trilha`),
                    // mesmo padrão de nesting de `<ProtectedRoute requireRole="admin">`
                    // abaixo.
                    {
                        element: <RequiresUnlock unlockKey="portfolio" />,
                        children: [{ path: '/', element: <Portfolio /> }],
                    },
                    // 3.1 Hub de trilhas (tarefa 6.4, redesenhado na O.1) e 3.2 Lição
                    // — `/trilha/:id` é rota irmã, não filha de `/trilha`, já que a
                    // Lição ocupa a tela inteira dentro do mesmo <AppShell> (sem
                    // navegação aninhada nova). `/trilha/mapa/:trackNumber` (mapa
                    // vertical por trilha, O.3) tem segmento estático (`mapa`) próprio
                    // pra nunca colidir com `/trilha/:id` (UUID) — `trackNumber`
                    // inválido/fora do currículo redireciona pro Hub.
                    { path: '/trilha', element: <TrilhasHub /> },
                    { path: '/trilha/mapa/:trackNumber', element: <TrackMap /> },
                    { path: '/trilha/:id', element: <Lesson /> },
                    // Tela 4.1 (hub) + 4.2/4.3 (Renda Fixa) + 4.4/4.5/4.6 (Renda
                    // Variável) + 4.7 (Confirmação de Ordem, tarefa 6.5). 4.7 não é
                    // rota própria: é `OrderConfirmationDialog`, overlay renderizado
                    // por `AssetDetail`/`FixedIncomeDetail` sobre a própria tela de
                    // origem (identidade-visual-padroes.md §7 — bottom sheet/modal).
                    { path: '/mercado', element: <Market /> },
                    { path: '/mercado/renda-fixa', element: <FixedIncomeList /> },
                    { path: '/mercado/renda-fixa/:id', element: <FixedIncomeDetail /> },
                    { path: '/mercado/renda-variavel', element: <EquityList /> },
                    { path: '/mercado/ativos/:id', element: <AssetDetail /> },
                    { path: '/mercado/empresas/:id', element: <CompanyProfile /> },
                    // 4.9 Indicadores Econômicos (tarefa M.4) — irmã de
                    // `/mercado/*`, não desbloqueada pela trilha (mesmo
                    // tratamento do hub 4.1, dado informativo, não produto).
                    { path: '/mercado/indicadores', element: <IndicadoresEconomicos /> },
                    {
                        element: <RequiresUnlock unlockKey="calculator" />,
                        children: [{ path: '/calculadora', element: <Calculator /> }],
                    },
                    { path: '/classificacao', element: <Classificacao /> },
                    // Notícias só desbloqueia de verdade na lição que libera
                    // `news_feed` (Fase Q, reversão da decisão original de
                    // 7.0.1 de tratar o feed como "sempre acessível, só
                    // aviso") — mesmo gate real de Portfólio/Calculadora.
                    {
                        element: <RequiresUnlock unlockKey="news_feed" />,
                        children: [{ path: '/noticias', element: <News /> }],
                    },
                    // Destino do clique no card de patrimônio (tela 2.1, tarefa 6.3)
                    // — conteúdo real (4.8 Extrato, tarefa 6.5).
                    { path: '/extrato', element: <Statement /> },
                    { path: '/perfil', element: <MeuPerfil /> },
                    // Tarefa 6.9 — 8.1 (hub) + 8.2 (buscar) + 8.3
                    // (solicitações). `/perfil/:id` é rota irmã de `/perfil`
                    // (self, 9.1 "Meu Perfil", tarefa 6.10): 8.4 "Perfil
                    // Público de Outro Usuário" é acessada tanto daqui quanto
                    // da Classificação (7.1, `RankingBoard`).
                    { path: '/amigos', element: <Amigos /> },
                    { path: '/amigos/buscar', element: <BuscarAmigos /> },
                    { path: '/amigos/solicitacoes', element: <SolicitacoesAmizade /> },
                    { path: '/perfil/:id', element: <PerfilPublico /> },
                    { path: '/conquistas', element: <Conquistas /> },
                    // 9.2 Configurações de Conta (tarefa 6.10). `/configuracoes/privacidade`
                    // é rota irmã (9.3 Privacidade e LGPD, acessada a partir de 9.2,
                    // inventário) — mesmo padrão de nesting de `/amigos/*`.
                    { path: '/configuracoes', element: <Configuracoes /> },
                    { path: '/configuracoes/privacidade', element: <PrivacidadeLgpd /> },
                    {
                        element: <ProtectedRoute requireRole="admin" />,
                        children: [
                            { path: '/admin', element: <PainelAdmin /> },
                            { path: '/admin/eventos/novo', element: <CriarEventoMacro /> },
                        ],
                    },
                ],
            },
        ],
    },
])
