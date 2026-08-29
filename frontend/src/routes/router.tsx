import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { AppShell } from '../components/templates/AppShell'
import { AuthCallback } from '../pages/AuthCallback'
import { Login } from '../pages/Login'
import { News } from '../pages/News'
import { Onboarding } from '../pages/Onboarding'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { Portfolio } from '../pages/Portfolio'

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
                    { path: '/trilha', element: <PlaceholderPage title="Trilha" /> },
                    { path: '/mercado', element: <PlaceholderPage title="Mercado" /> },
                    { path: '/calculadora', element: <PlaceholderPage title="Calculadora" /> },
                    { path: '/classificacao', element: <PlaceholderPage title="Classificação" /> },
                    { path: '/noticias', element: <News /> },
                    // Destino do clique no card de patrimônio (tela 2.1, tarefa 6.3)
                    // — conteúdo real (4.8 Extrato) é escopo da tarefa 6.5, ainda não
                    // implementada; só a navegação já existe, mesmo padrão das
                    // demais rotas de placeholder desta lista (tarefa 6.1).
                    { path: '/extrato', element: <PlaceholderPage title="Extrato" /> },
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
