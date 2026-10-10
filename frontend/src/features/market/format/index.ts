const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// `daily_change_pct`/`realized_return_pct`/`vs_contracted_rate` já chegam
// multiplicados por 100 do motor (`.docs/engine/catalog.md`) — diferente de
// `formatPercentage` (`features/portfolio/format`), que espera uma razão
// 0–1 (roe/margens/dividend_yield/tax_rate). Formatar os dois com a mesma
// função esconderia esse fator 100 de diferença, por isso ganham a própria
// função aqui, com sinal explícito (convenção "home broker" de sempre
// mostrar +/− numa variação).
export function formatSignedPercent(alreadyPercentValue: number): string {
    const sign = alreadyPercentValue > 0 ? '+' : alreadyPercentValue < 0 ? '−' : ''
    return `${sign}${decimalFormatter.format(Math.abs(alreadyPercentValue))}%`
}

// P/L, P/VP, ROE em número absoluto (não indicadores de %) — 1 casa
// decimal, mesmo padrão de exibição do mockup vivo (identidade-visual-
// padroes.md §0).
export function formatDecimal(value: number): string {
    return decimalFormatter.format(value)
}

// P/VP de FII com 2 casas: a faixa relevante (0,75 a 1,00) some com 1 casa
// (0,75 e 0,78 virariam 0,8), então diferente de `formatDecimal`.
const priceToBookFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatPriceToBook(value: number): string {
    return priceToBookFormatter.format(value)
}

// `fixed_income.interest_rate` (`GET /market/assets/:id`) já vem em pontos
// percentuais (ex: `11.75` = 11,75%) — confirmado em
// `fixedincomeexecution.Purchase` (`ctx.AnnualRatePct / 100` antes de virar
// razão pro motor). Escala diferente de `average_rate` (posição, já vem
// como razão 0–1) e de `roe`/`dividend_yield`/`tax_rate` (`formatPercentage`,
// `features/portfolio/format`) — motivo de ganhar a própria função, sem
// multiplicar por 100 de novo. O que esse número SIGNIFICA depende do tipo
// de produto desde a tarefa L.1 (backlog-motor-mercado-realista) — ver
// `fixedIncomeRateLabel` abaixo.
export function formatRatePercent(alreadyPercentValue: number): string {
    return `${decimalFormatter.format(alreadyPercentValue)}%`
}

// Tipos de renda fixa pós-fixados (`fixedincome.IsPostFixado`, engine) —
// tarefa L.1 do backlog-motor-mercado-realista: `interest_rate` deixou de
// significar "taxa anual" pra esses 6 tipos e passou a significar "% do
// CDI/Selic contratado" (ex: `110` = "110% do CDI"), mesma convenção da
// lição 3.3 da spec ("CDB 110% CDI líquido vs LCI 90% CDI isento"). Tesouro
// Prefixado é o único tipo realmente "a.a." (taxa travada na compra);
// Tesouro IPCA+ continua mostrado como "a.a." também — a taxa real
// contratada do IPCA+ (L.2 não mudou essa exibição).
const POST_FIXADO_ASSET_TYPES = new Set(['tesouro_selic', 'cdb', 'lci', 'lca', 'cri', 'cra'])

export function isPostFixadoAssetType(assetType: string): boolean {
    return POST_FIXADO_ASSET_TYPES.has(assetType)
}

// Rótulo pra acompanhar `formatRatePercent(fixed_income.interest_rate)` na
// tela de detalhe do ativo (tela 4.3) — "do CDI" pros 6 tipos pós-fixados,
// "a.a." pra Tesouro Prefixado/Tesouro IPCA+.
export function fixedIncomeRateLabel(assetType: string): string {
    return isPostFixadoAssetType(assetType) ? 'do CDI' : 'a.a.'
}
