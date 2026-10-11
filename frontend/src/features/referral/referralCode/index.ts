// Código de indicação que chega pelo link `/login?ref=CODIGO` e acompanha a pessoa até o
// cadastro (MO.7.2). Só formato: quem confere se o código existe é o servidor, que ignora o ruim.
const STORAGE_KEY = 'selucra:referral-code'
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

export function normalizeReferralCode(raw: string | null | undefined): string | null {
    const code = raw?.trim().toUpperCase() ?? ''
    return CODE_PATTERN.test(code) ? code : null
}

// Guarda o código do link, se válido, e devolve o que vale agora (o do link ou o já guardado).
export function captureReferralCode(search: string): string | null {
    const fromLink = normalizeReferralCode(new URLSearchParams(search).get('ref'))
    try {
        if (fromLink) {
            sessionStorage.setItem(STORAGE_KEY, fromLink)
            return fromLink
        }
        return normalizeReferralCode(sessionStorage.getItem(STORAGE_KEY))
    } catch {
        return fromLink
    }
}

export function clearReferralCode(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        // sem armazenamento (janela privada): nada a limpar
    }
}

// Link que a pessoa compartilha: abre a tela de cadastro já com o código.
export function buildInviteLink(origin: string, code: string): string {
    return `${origin}/login?ref=${code}`
}
