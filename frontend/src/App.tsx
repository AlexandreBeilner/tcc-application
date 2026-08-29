import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { router } from './routes/router'

// Única lib de data fetching do frontend (tarefa 6.1, decisão da
// introdução da Semana 6) — cache/revalidação/loading/erro pras ~28 telas,
// em vez de reescrever isso à mão em cada uma.
const queryClient = new QueryClient()

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <RouterProvider router={router} />
            </AuthProvider>
        </QueryClientProvider>
    )
}
