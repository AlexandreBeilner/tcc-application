import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AppShell } from '../shell/AppShell'
import { Home } from '../pages/Home'
import { Login } from '../pages/Login'
import { News } from '../pages/News'
import { PlaceholderPage } from '../pages/PlaceholderPage'

// <AppShell> (tab bar + top bar + <Outlet/>) envolve todas as rotas
// autenticadas (tarefa 6.1) — a rota de auth (1.1) fica fora do shell. As
// rotas abaixo além de "/" são só navegáveis por enquanto (conteúdo é
// tarefa futura do backlog) — ver `PlaceholderPage`. `/admin` ganha uma
// segunda camada de `<ProtectedRoute requireRole="admin">`: o item
// "Painel Administrativo" só aparece no menu do avatar pra `role=admin`,
// mas a rota em si precisa ser protegida de verdade, não só escondida via
// CSS (critério de aceite da tarefa 6.1).
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/trilha', element: <PlaceholderPage title="Trilha" /> },
          { path: '/mercado', element: <PlaceholderPage title="Mercado" /> },
          { path: '/calculadora', element: <PlaceholderPage title="Calculadora" /> },
          { path: '/classificacao', element: <PlaceholderPage title="Classificação" /> },
          { path: '/noticias', element: <News /> },
          { path: '/perfil', element: <PlaceholderPage title="Meu Perfil" /> },
          { path: '/amigos', element: <PlaceholderPage title="Amigos" /> },
          { path: '/conquistas', element: <PlaceholderPage title="Conquistas" /> },
          {
            path: '/configuracoes',
            element: <PlaceholderPage title="Configurações e Privacidade" />,
          },
          {
            element: <ProtectedRoute requireRole="admin" />,
            children: [
              { path: '/admin', element: <PlaceholderPage title="Painel Administrativo" /> },
            ],
          },
        ],
      },
    ],
  },
])
