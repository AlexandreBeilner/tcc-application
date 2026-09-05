export type PasswordStrength = 'weak' | 'medium' | 'strong'

// Indicador de força de senha (tarefa 6.10.6, tela 1.1 — cadastro) — heurística
// simples de pontos por comprimento + variedade de classe de caractere, sem
// dependência externa (zxcvbn seria overkill pro escopo do MVP). `null`
// pra campo vazio: a UI não mostra indicador antes do usuário digitar nada.
export function computePasswordStrength(password: string): PasswordStrength | null {
    if (password.length === 0) {
        return null
    }

    let score = 0
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
    if (/\d/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1

    if (score <= 1) return 'weak'
    if (score <= 3) return 'medium'
    return 'strong'
}
