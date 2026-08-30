import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { AppShell } from '../components/templates/AppShell'
import { AssetDetail } from '../pages/AssetDetail'
import { AuthCallback } from '../pages/AuthCallback'
import { Calculator } from '../pages/Calculator'
import { CompanyProfile } from '../pages/CompanyProfile'
import { EquityList } from '../pages/EquityList'
import { FixedIncomeDetail } from '../pages/FixedIncomeDetail'
import { FixedIncomeList } from '../pages/FixedIncomeList'
import { Lesson } from '../pages/Lesson'
import { Login } from '../pages/Login'
import { Market } from '../pages/Market'
import { News } from '../pages/News'
import { Onboarding } from '../pages/Onboarding'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { Portfolio } from '../pages/Portfolio'
import { Statement } from '../pages/Statement'
import { Track } from '../pages/Track'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — as rotas de auth (1.1, `/auth/callback`) e
// onboarding (1.2) ficam fora do shell. As rotas abaixo além de "/" são só
// navegáveis por enquanto (conteúdo é tarefa futura do backlog) — ver
// `PlaceholderPage`. `/admin` ganha uma segunda camada de `<ProtectedRoute
// requireRole="admin">`: o item "Painel Administrativo" só aparece no menu
// do avatar pra `role=admin`, mas a rota em si precisa ser protegida de
// verdade, não só escondida via CSS (critério de aceite da tarefa 6.1).
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
                    { path: '/', element: <Portfolio /> },
                    // 3.1 Mapa da Trilha e 3.2 Lição (tarefa 6.4) — `/trilha/:id`
                    // é rota irmã, não filha de `/trilha`, já que a Lição ocupa a
                    // tela inteira dentro do mesmo <AppShell> (sem navegação
                    // aninhada nova).
                    { path: '/trilha', element: <Track /> },
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
                    { path: '/calculadora', element: <Calculator /> },
                    { path: '/classificacao', element: <PlaceholderPage title="Classificação" /> },
                    { path: '/noticias', element: <News /> },
                    // Destino do clique no card de patrimônio (tela 2.1, tarefa 6.3)
                    // — conteúdo real (4.8 Extrato, tarefa 6.5).
                    { path: '/extrato', element: <Statement /> },
                    { path: '/perfil', element: <PlaceholderPage title="Meu Perfil" /> },
                    { path: '/amigos', element: <PlaceholderPage title="Amigos" /> },
                    { path: '/conquistas', element: <PlaceholderPage title="Conquistas" /> },
                    {
                        path: '/configuracoes',
                        element: <PlaceholderPage title="Configurações e Privacidade" />,
                    },
                    {
                        element: <ProtectedRoute requireRole="admin" />,
                        children: [{ path: '/admin', element: <PlaceholderPage title="Painel Administrativo" /> }],
                    },
                ],
            },
        ],
    },
])
