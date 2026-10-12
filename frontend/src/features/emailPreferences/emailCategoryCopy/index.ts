import type { EmailCategory } from '../../../services/emailPreferences'

// Textos das duas categorias opcionais, em um lugar só: Configurações, onboarding e a página de
// cancelar inscrição falam das mesmas coisas com as mesmas palavras. Sem travessão (copy de UI).
export const EMAIL_CATEGORY_COPY: Record<EmailCategory, { title: string; description: string; label: string }> = {
    social: {
        title: 'Amigos',
        description: 'Aviso quando alguém te envia um pedido de amizade ou aceita o seu. No máximo um por dia.',
        label: 'e-mails sobre amigos',
    },
    engagement: {
        title: 'Resumo e lembretes',
        description:
            'Resumo semanal da sua evolução, aviso do salário mensal e de conquistas raras, e um convite para continuar sua sequência. Sempre um convite, nunca uma cobrança.',
        label: 'e-mails de resumo e lembretes',
    },
}

export const EMAIL_CATEGORIES: readonly EmailCategory[] = ['social', 'engagement']
