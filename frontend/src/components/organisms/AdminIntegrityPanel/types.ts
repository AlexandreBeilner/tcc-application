import type { IntegrityRun } from '../../../services/admin'

export interface AdminIntegrityPanelProps {
    run: IntegrityRun | null
    // A consulta da última verificação ainda carregando (primeira abertura da tela).
    loading: boolean
    // Abrindo uma verificação agora (entre o clique e a resposta do motor).
    starting: boolean
    onStart: () => void
}
