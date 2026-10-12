// Espelha `.docs/backend/assemblies.md` (leitura pública, voto e propostas de pauta).
export type AssemblyStatus = 'open' | 'closed'
export type AssemblyOutcome = 'approved' | 'not_approved'
export type AssemblyOutcomeReason = 'decided' | 'quorum' | 'tie'

export interface AssemblySummary {
    id: string
    kind: string
    // Empresa (kind `shareholder`).
    subjectRef: string
    subjectLabel: string | null
    title: string | null
    status: AssemblyStatus
    opensAt: string
    closesAt: string
    effectAppliesAt: string
    effectAppliedAt: string | null
    outcome: AssemblyOutcome | null
    outcomeReason: AssemblyOutcomeReason | null
    voterCount: number | null
    // O dividendo do balanço da empresa está retido esperando esta assembleia (destinação do lucro).
    dividendOnHold: boolean
}

export interface AssemblyList {
    open: AssemblySummary[]
    closed: AssemblySummary[]
}

export type DividendPolicyValue = 'quarterly' | 'semiannual' | 'annual'

// O que a opção mexe na empresa (MO.6.13): de 1 a 2 efeitos por opção. Os degraus trazem sentido e
// a fração (0 a 1] da faixa que o motor permite, nunca valor absoluto; a política de dividendo é
// discreta e traz o valor-alvo.
export type AssemblyEffectPreview =
    | { metric: 'growth' | 'quality' | 'payout' | 'pn_premium'; direction: 1 | -1; intensity: number }
    | { metric: 'dividend_policy'; value: DividendPolicyValue }

export interface AssemblyOption {
    id: string
    key: string
    label: string
    gain: string
    loss: string
    // O primeiro efeito (mantido para quem lê um só).
    effect: AssemblyEffectPreview | null
    // Todos os efeitos da opção, na ordem da pauta e com o mesmo peso.
    effects: AssemblyEffectPreview[]
    position: number
}

export interface OptionScore {
    optionId: string
    voters: number
    // 0 a 100, sobre as ações de quem votou.
    weightPercent: number
}

export interface AssemblyResult {
    outcome: AssemblyOutcome
    reason: AssemblyOutcomeReason
    winningOptionId: string | null
    voterCount: number
    decidedAt: string
}

export interface AssemblyDetail {
    assembly: AssemblySummary & { description: string | null }
    options: AssemblyOption[]
    scoreboard: { voters: number; options: OptionScore[] }
    result: AssemblyResult | null
    minVoters: number
}

export type VoteDenialReason = 'not_open' | 'not_shareholder' | 'email_not_verified' | 'level_too_low' | 'no_credit'

export interface MyVotingStatus {
    assemblyId: string
    isPro: boolean
    canVote: boolean
    reason: VoteDenialReason | null
    message: string | null
    myVote: { optionId: string } | null
    myShares: number | null
    credit: { monthKey: string; limit: number; used: number; available: number; minLevel: number }
}

export interface CastVoteResult {
    optionId: string
    changed: boolean
    creditConsumed: boolean
}

export type ProposalBlockedReason = 'not_shareholder' | 'company_in_cooldown'

export interface ProposalView {
    id: string
    templateKey: string
    title: string
    description: string
    options: Array<{ label: string; gain: string; loss: string }>
    supportCount: number
    supportedByMe: boolean
    proposedByMe: boolean
    expiresAt: string
    // 1 = a próxima a ser escolhida; nulo enquanto não tem o mínimo de apoios.
    queuePosition: number | null
}

export interface CompanyProposals {
    company: { id: string; name: string; sector: string }
    isPro: boolean
    holdsShares: boolean
    cooldownDaysLeft: number
    blockedReason: ProposalBlockedReason | null
    limits: { monthlyCap: number; usedThisMonth: number; minSupport: number; ttlDays: number }
    proposals: ProposalView[]
    availableTemplates: Array<{ key: string; title: string; description: string; hasActiveProposal: boolean }>
}

export interface ProposalSummary {
    id: string
    templateKey: string
    supportCount: number
    supportedByMe: boolean
    proposedByMe: boolean
    expiresAt: string
}
