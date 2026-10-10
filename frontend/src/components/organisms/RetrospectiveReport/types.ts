import type { Retrospective } from '../../../services/retrospectives'

export interface RetrospectiveReportProps {
    retrospective: Retrospective
    // Para mostrar a imagem de compartilhar com a identidade de quem olha.
    identity: { username: string; isPro: boolean; frame: string | null; title: string | null }
    // Cobrança desligada: não convida para o PRO.
    billingEnabled: boolean
}
