// Contas e dados dos widgets de planejamento (RC.3.4h). Funções puras. Todos os números
// de volatilidade, retorno e queda são ILUSTRATIVOS, para mostrar a relação entre risco e
// retorno e a ideia de perfil: não são histórico nem previsão, e os widgets dizem isso.

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive'

export const PROFILE_LABEL: Record<RiskProfile, string> = {
    conservative: 'Conservador',
    moderate: 'Moderado',
    aggressive: 'Arrojado',
}

export type ProductId = 'savings' | 'selic-bond' | 'cdb' | 'ipca-bond' | 'fii' | 'stocks'

export interface RiskProduct {
    id: ProductId
    name: string
    // Oscilação anual do preço, em % (ilustrativa).
    volatilityPct: number
    // Retorno esperado ao ano, em % (ilustrativo; esperado não é garantido).
    expectedReturnPct: number
    note: string
}

export const RISK_PRODUCTS: RiskProduct[] = [
    { id: 'savings', name: 'Poupança', volatilityPct: 0.5, expectedReturnPct: 7, note: 'Quase não oscila e rende pouco.' },
    {
        id: 'selic-bond',
        name: 'Tesouro Selic',
        volatilityPct: 1,
        expectedReturnPct: 10,
        note: 'Preço quase estável, acompanha a taxa básica de juros.',
    },
    {
        id: 'cdb',
        name: 'CDB',
        volatilityPct: 1.5,
        expectedReturnPct: 10.5,
        note: 'Pouca oscilação, mas carrega o risco de crédito do banco.',
    },
    {
        id: 'ipca-bond',
        name: 'Tesouro IPCA+',
        volatilityPct: 6,
        expectedReturnPct: 11,
        note: 'Protege da inflação, mas o preço oscila antes do vencimento.',
    },
    {
        id: 'fii',
        name: 'Fundo imobiliário',
        volatilityPct: 14,
        expectedReturnPct: 12,
        note: 'Rendimento mensal, com oscilação do preço da cota.',
    },
    {
        id: 'stocks',
        name: 'Ações',
        volatilityPct: 22,
        expectedReturnPct: 14,
        note: 'Maior retorno esperado e maior oscilação, com anos de queda forte.',
    },
]

// Oscilação máxima que cada perfil costuma aceitar, em % ao ano (ilustrativa).
export const PROFILE_MAX_VOLATILITY: Record<RiskProfile, number> = {
    conservative: 3,
    moderate: 15,
    aggressive: 100,
}

export function productsWithin(profile: RiskProfile): RiskProduct[] {
    return RISK_PRODUCTS.filter((product) => product.volatilityPct <= PROFILE_MAX_VOLATILITY[profile])
}

export type AllocationClass = 'post-fixed' | 'longer-fixed' | 'fii' | 'stocks'

export const ALLOCATION_CLASSES: { key: AllocationClass; label: string; yearBadDropPct: number }[] = [
    { key: 'post-fixed', label: 'Pós-fixado e liquidez', yearBadDropPct: 0 },
    { key: 'longer-fixed', label: 'Renda fixa de prazo maior', yearBadDropPct: 8 },
    { key: 'fii', label: 'Fundos imobiliários', yearBadDropPct: 15 },
    { key: 'stocks', label: 'Ações e ETFs', yearBadDropPct: 30 },
]

export type Allocation = Record<AllocationClass, number>

// Exemplos de divisão por perfil, para mostrar a ideia. Não são recomendação.
export const EXAMPLE_ALLOCATIONS: Record<RiskProfile, Allocation> = {
    conservative: { 'post-fixed': 70, 'longer-fixed': 20, fii: 5, stocks: 5 },
    moderate: { 'post-fixed': 40, 'longer-fixed': 25, fii: 10, stocks: 25 },
    aggressive: { 'post-fixed': 15, 'longer-fixed': 15, fii: 15, stocks: 55 },
}

export function allocationTotal(allocation: Allocation): number {
    return ALLOCATION_CLASSES.reduce((sum, { key }) => sum + allocation[key], 0)
}

// Fatia de cada classe sobre o total informado (para o donut fechar em 100% mesmo se a soma não bater).
export function normalizedShares(allocation: Allocation): Allocation {
    const total = allocationTotal(allocation)
    const entries = ALLOCATION_CLASSES.map(({ key }) => [key, total <= 0 ? 0 : (allocation[key] / total) * 100])
    return Object.fromEntries(entries) as Allocation
}

export interface BadYearResult {
    lossPct: number
    lossAmount: number
    // Contribuição de cada classe para a perda, em pontos percentuais da carteira.
    byClass: { key: AllocationClass; contributionPct: number }[]
}

// Perda de uma carteira num ano ruim ilustrativo: soma de peso x queda da classe.
export function badYearLoss(allocation: Allocation, amount: number): BadYearResult {
    const shares = normalizedShares(allocation)
    const byClass = ALLOCATION_CLASSES.map(({ key, yearBadDropPct }) => ({ key, contributionPct: (shares[key] * yearBadDropPct) / 100 }))
    const lossPct = byClass.reduce((sum, item) => sum + item.contributionPct, 0)
    return { lossPct, lossAmount: (amount * lossPct) / 100, byClass }
}

export interface QuizQuestion {
    id: string
    prompt: string
    // Pontos de 1 (mais cauteloso) a 3 (mais tolerante a risco), na ordem das opções.
    options: { label: string; points: 1 | 2 | 3 }[]
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        id: 'horizon',
        prompt: 'Por quanto tempo você deixaria o dinheiro investido, sem precisar dele?',
        options: [
            { label: 'Menos de 1 ano', points: 1 },
            { label: 'De 1 a 5 anos', points: 2 },
            { label: 'Mais de 5 anos', points: 3 },
        ],
    },
    {
        id: 'reaction',
        prompt: 'Seu investimento cai 20% em um mês. O que você faz?',
        options: [
            { label: 'Vendo tudo para não perder mais', points: 1 },
            { label: 'Espero, mas fico bem preocupado', points: 2 },
            { label: 'Mantenho e, se der, aporto mais', points: 3 },
        ],
    },
    {
        id: 'goal',
        prompt: 'Qual é o principal objetivo desse dinheiro?',
        options: [
            { label: 'Proteger o que tenho', points: 1 },
            { label: 'Crescer com algum risco', points: 2 },
            { label: 'Crescer o máximo possível no longo prazo', points: 3 },
        ],
    },
    {
        id: 'experience',
        prompt: 'Qual é a sua experiência com investimentos?',
        options: [
            { label: 'Só poupança ou nenhuma', points: 1 },
            { label: 'Renda fixa e alguns fundos', points: 2 },
            { label: 'Também ações e fundos imobiliários', points: 3 },
        ],
    },
    {
        id: 'income',
        prompt: 'Quanto da sua renda depende de algo estável?',
        options: [
            { label: 'Minha renda é incerta ou eu sustento outras pessoas', points: 1 },
            { label: 'Tenho renda razoavelmente estável', points: 2 },
            { label: 'Tenho renda estável e folga no orçamento', points: 3 },
        ],
    },
    {
        id: 'reserve',
        prompt: 'Você já tem uma reserva de emergência montada?',
        options: [
            { label: 'Não', points: 1 },
            { label: 'Em parte', points: 2 },
            { label: 'Sim, completa', points: 3 },
        ],
    },
]

export interface QuizResult {
    score: number
    maxScore: number
    profile: RiskProfile
    // `true` quando a capacidade de risco limitou o resultado, mesmo com pontuação maior.
    capped: boolean
}

// Pontuação somada: até 40% dos pontos possíveis é conservador, até 70% moderado, acima disso
// arrojado. Precisar do dinheiro em menos de 1 ano, ou não ter reserva, limita o perfil
// (a capacidade de risco pesa mais que a vontade): o que o aluno topa não é o que ele aguenta.
export function riskProfileFromAnswers(answers: Record<string, 1 | 2 | 3>): QuizResult {
    const maxScore = QUIZ_QUESTIONS.length * 3
    const score = QUIZ_QUESTIONS.reduce((sum, question) => sum + (answers[question.id] ?? 0), 0)
    const ratio = score / maxScore
    let profile: RiskProfile = ratio <= 0.4 ? 'conservative' : ratio <= 0.7 ? 'moderate' : 'aggressive'
    let capped = false
    if (answers.horizon === 1 && profile !== 'conservative') {
        profile = 'conservative'
        capped = true
    } else if (answers.reserve === 1 && profile === 'aggressive') {
        profile = 'moderate'
        capped = true
    }
    return { score, maxScore, profile, capped }
}
