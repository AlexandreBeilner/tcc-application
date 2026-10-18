import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import { App } from './App'
import { captureDiarioOrigin } from './features/diario/origin'
import { listenForInstall } from './features/pwa/install'
import { registerServiceWorker } from './features/pwa/serviceWorker'

// Origem do Diário (DI.7.1): guarda `?origem=diario` antes de qualquer redirecionamento apagar a query.
captureDiarioOrigin(window.location.search)

// PWA (LW.2): escuta o convite de instalação antes de o navegador disparar o evento e registra o service worker.
listenForInstall()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
