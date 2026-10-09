// Contas da gangorra de marcação a mercado (RC.3.4b). Funções puras. Preço de
// um título que paga o valor de face no vencimento, descontado à taxa de mercado
// (capitalização anual, prazo em anos): face / (1 + taxa)^anos.
export const FACE_VALUE = 1000

export type MtmIndexer = 'prefixed' | 'ipca-plus' | 'selic'

export function bondPrice(ratePct: number, years: number, face = FACE_VALUE): number {
    return face / Math.pow(1 + ratePct / 100, years)
}

// O título pós-fixado na Selic reprecifica todo dia, então o prazo que importa
// para a oscilação do preço é o de um dia útil (1/252), não o do vencimento.
export function pricingYears(indexer: MtmIndexer, yearsToMaturity: number): number {
    return indexer === 'selic' ? 1 / 252 : yearsToMaturity
}

export interface MtmOutcome {
    purchasePrice: number
    currentPrice: number
    changePct: number
}

export function mtmOutcome(contractRatePct: number, marketRatePct: number, years: number): MtmOutcome {
    const purchasePrice = bondPrice(contractRatePct, years)
    const currentPrice = bondPrice(marketRatePct, years)
    return { purchasePrice, currentPrice, changePct: (currentPrice / purchasePrice - 1) * 100 }
}

export const MAX_TILT_DEG = 16

// Inclinação da gangorra: taxa de mercado acima da contratada sobe o lado da
// taxa e desce o do preço. Saturada em +-MAX_TILT_DEG; 8 p.p. de diferença enche.
export function seesawTiltDeg(contractRatePct: number, marketRatePct: number): number {
    const tilt = ((marketRatePct - contractRatePct) / 8) * MAX_TILT_DEG
    return Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, tilt))
}
