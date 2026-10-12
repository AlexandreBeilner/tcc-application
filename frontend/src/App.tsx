import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { UpdateNotice } from './components/molecules/UpdateNotice'
import { AuthProvider } from './features/auth/AuthContext'
import { RewardRevealProvider } from './features/shell/RewardRevealProvider'
import { ThemeProvider } from './features/theme/ThemeContext'
import { router } from './routes/router'

// Única lib de data fetching do frontend (tarefa 6.1, decisão da
// introdução da Semana 6) — cache/revalidação/loading/erro pras ~28 telas,
// em vez de reescrever isso à mão em cada uma.
const queryClient = new QueryClient()

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <AuthProvider>
                    <RewardRevealProvider>
                        <RouterProvider router={router} />
                        <UpdateNotice />
                    </RewardRevealProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}
