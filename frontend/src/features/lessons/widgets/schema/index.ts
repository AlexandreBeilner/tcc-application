import { z } from 'zod'

// Espelho do contrato `blocks` do backend
// (`backend/src/modules/lessons/infrastructure/content/lessonBlocks.ts`, RC.3.1).
// O backend valida no seed e na leitura; o frontend valida de novo ao
// renderizar (um `blocks` inválido ou widget desconhecido nunca derruba a
// lição). Os dois testes de contrato usam o mesmo exemplo.
export const WIDGET_IDS = [
    'callout',
    'platform-note',
    'formula-walkthrough',
    'equivalent-rate',
    'ir-regressive-table',
    'product-comparator',
    'compound-growth',
    'real-return',
    'selic-ipca-chart',
    'copom-timeline',
    'inflation-selic-seesaw',
    'emergency-fund-calculator',
    'where-to-keep',
    'mtm-seesaw',
    'fgc-coverage-bar',
    'rating-ruler',
    'bond-price-calculator',
    'ipca-plus-simulator',
    'breakeven-inflation',
    'ownership-calculator',
    'bookbuilding-simulator',
    'ticker-decoder',
    'headline-triage',
    'order-book',
    'interactive-balance',
    'margin-comparator',
    'roe-lab',
    'multiples-calculator',
    'debt-thermometer',
    'dividend-timeline',
    'dividend-net-calculator',
    'etf-shock-simulator',
    'fii-monthly-calendar',
    'fee-drag',
    'risk-return-scatter',
    'allocation-donut',
    'risk-profile-quiz',
    'behavior-bias-quiz',
    'budget-split',
    'debt-snowball',
    'pay-or-invest',
    'equity-tax-calculator',
    'tax-decision-tree',
    'savings-vs-selic',
    'growth-calculator',
    'fixed-income-comparison',
    'live-indicator',
    'live-macro',
] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

const emptyProps = z.object({}).strict()

const companyMarginsProps = z.object({
    netRevenue: z.number().positive().max(100_000),
    grossProfit: z.number().min(-100_000).max(100_000),
    ebit: z.number().min(-100_000).max(100_000),
    netIncome: z.number().min(-100_000).max(100_000),
})

export const widgetPropsSchemas = {
    callout: z.object({
        tone: z.enum(['info', 'tip', 'warning']).default('info'),
        title: z.string().min(1),
        body: z.string().min(1),
        formula: z.string().min(1).optional(),
    }),
    'formula-walkthrough': z.object({
        intro: z.string().min(1).optional(),
        items: z
            .array(
                z.object({
                    label: z.string().min(1),
                    formula: z.string().min(1),
                    legend: z.string().min(1).optional(),
                    numbers: z.string().min(1),
                    result: z.string().min(1),
                }),
            )
            .min(1)
            .max(3),
        note: z.string().min(1).optional(),
    }),
    'platform-note': z.object({
        brazil: z.string().min(1),
        here: z.string().min(1),
        why: z.string().min(1),
    }),
    'equivalent-rate': z.object({
        exemptRatePct: z.number().positive().max(100).default(9.5),
        cdbRatePct: z.number().positive().max(100).default(12),
        daysPresets: z.array(z.number().int().min(1).max(3650)).min(1).max(4).default([60, 720]),
    }),
    'ir-regressive-table': z.object({
        grossYield: z.number().positive().default(1000),
        initialDays: z.number().int().min(1).max(1000).default(90),
    }),
    'product-comparator': z.object({
        products: z
            .array(
                z.object({
                    name: z.string().min(1),
                    annualRatePct: z.number().positive().max(100),
                    taxExempt: z.boolean(),
                    liquidity: z.string().min(1).optional(),
                    fgc: z.string().min(1).optional(),
                }),
            )
            .min(2)
            .max(3),
        amount: z.number().positive().default(10000),
        days: z.number().int().min(1).max(3650).default(180),
    }),
    'compound-growth': z.object({
        initial: z.number().min(0).max(10_000_000).default(1000),
        monthly: z.number().min(0).max(1_000_000).default(0),
        ratePct: z.number().min(0).max(100).default(10),
        rateUnit: z.enum(['year', 'month']).default('year'),
        months: z.number().int().min(1).max(480).default(60),
        showSimple: z.boolean().default(true),
    }),
    'real-return': z.object({
        nominalPct: z.number().min(0).max(20).default(10),
        inflationPct: z.number().min(0).max(20).default(5),
        amount: z.number().positive().default(10000),
    }),
    'selic-ipca-chart': z.object({ windowDays: z.number().int().min(7).max(365).default(365) }),
    'copom-timeline': emptyProps,
    'inflation-selic-seesaw': z.object({ inflationPct: z.number().min(0).max(15).default(6) }),
    'emergency-fund-calculator': z.object({
        monthlyCost: z.number().min(0).max(1_000_000).default(3000),
        incomeType: z.enum(['stable', 'variable']).default('stable'),
        monthlyContribution: z.number().min(0).max(1_000_000).default(500),
    }),
    'where-to-keep': emptyProps,
    'mtm-seesaw': z.object({
        contractRatePct: z.number().min(2).max(25).default(11.75),
        yearsToMaturity: z.number().min(0.25).max(10).default(2),
        indexer: z.enum(['prefixed', 'ipca-plus', 'selic']).default('prefixed'),
    }),
    'fgc-coverage-bar': z.object({
        amountPerInstitution: z.number().min(0).max(5_000_000).default(400_000),
        institutions: z.number().int().min(1).max(6).default(1),
        sameConglomerate: z.boolean().default(false),
    }),
    'bond-price-calculator': z.object({
        ratePct: z.number().min(6).max(18).default(11.75),
        years: z.number().min(0.25).max(10).default(2),
        amount: z.number().min(30).max(10_000_000).default(10_000),
    }),
    'ipca-plus-simulator': z.object({
        amount: z.number().positive().max(10_000_000).default(10_000),
        realRatePct: z.number().min(3).max(9).default(6),
        years: z.number().int().min(1).max(20).default(5),
        ipcaPct: z.number().min(0).max(12).default(5),
    }),
    'breakeven-inflation': z.object({
        prefixedPct: z.number().min(6).max(18).default(12.5),
        realPct: z.number().min(3).max(10).default(7.5),
        expectedInflationPct: z.number().min(0).max(12).default(5),
    }),
    'ownership-calculator': z.object({
        price: z.number().positive().max(100_000).default(20),
        totalShares: z.number().int().positive().max(100_000_000_000).default(1_000_000),
        yourShares: z.number().int().min(0).max(100_000_000_000).default(100),
        profit: z.number().min(0).max(100_000_000_000).default(5_000_000),
        payoutPct: z.number().min(0).max(100).default(30),
    }),
    'bookbuilding-simulator': z.object({
        offeredShares: z.number().int().min(250_000).max(2_000_000).default(1_000_000),
        primaryPct: z.number().min(0).max(100).default(60),
        existingShares: z.number().int().positive().max(100_000_000_000).default(4_000_000),
    }),
    'ticker-decoder': emptyProps,
    'headline-triage': emptyProps,
    'order-book': emptyProps,
    'interactive-balance': z.object({
        netRevenue: z.number().positive().max(100_000).default(1000),
        costsPct: z.number().min(0).max(90).default(55),
        expensesPct: z.number().min(0).max(50).default(15),
        financialResult: z.number().min(-300).max(0).default(-100),
        taxPct: z.number().min(0).max(40).default(30),
        cash: z.number().min(0).max(1000).default(200),
        fixedAssets: z.number().min(0).max(2000).default(800),
        debt: z.number().min(0).max(2000).default(600),
        otherLiabilities: z.number().min(0).max(1000).default(150),
    }),
    'margin-comparator': z.object({
        a: companyMarginsProps.default({ netRevenue: 1000, grossProfit: 400, ebit: 200, netIncome: 50 }),
        b: companyMarginsProps.default({ netRevenue: 200, grossProfit: 90, ebit: 60, netIncome: 40 }),
    }),
    'roe-lab': z.object({
        revenue: z.number().positive().max(100_000).default(1000),
        netIncome: z.number().min(-100_000).max(100_000).default(100),
        assets: z.number().positive().max(100_000).default(1000),
        equity: z.number().positive().max(100_000).default(500),
        selicPct: z.number().min(2).max(16).default(10.5),
    }),
    'multiples-calculator': z.object({
        price: z.number().min(5).max(60).default(24),
        netIncome: z.number().min(-100_000).max(100_000).default(120),
        equity: z.number().min(-100_000).max(100_000).default(300),
        shares: z.number().positive().max(100_000).default(60),
        selicPct: z.number().min(2).max(16).default(10.5),
    }),
    'debt-thermometer': z.object({
        grossDebt: z.number().min(0).max(2000).default(800),
        cash: z.number().min(0).max(1500).default(300),
        ebit: z.number().min(-100_000).max(100_000).default(250),
        financialExpense: z.number().min(0).max(100_000).default(50),
        cdiSharePct: z.number().min(0).max(100).default(100),
    }),
    'dividend-timeline': z.object({
        quantity: z.number().int().min(1).max(1_000_000).default(100),
        valuePerShare: z.number().min(0.01).max(1000).default(1),
        comDay: z.number().int().min(1).max(5).default(3),
        paymentDay: z.number().int().min(8).max(30).default(12),
    }),
    'dividend-net-calculator': z.object({
        quantity: z.number().int().min(1).max(1_000_000).default(1000),
        valuePerShare: z.number().min(0.01).max(1000).default(1),
        kind: z.enum(['dividend', 'jcp']).default('dividend'),
        otherSameMonth: z.number().min(0).max(200_000).default(0),
    }),
    'etf-shock-simulator': z
        .object({
            holdings: z
                .array(z.object({ name: z.string().min(1).max(30), weightPct: z.number().min(1).max(100) }))
                .min(2)
                .max(6)
                .default([
                    { name: 'Empresa A', weightPct: 40 },
                    { name: 'Empresa B', weightPct: 20 },
                    { name: 'Empresa C', weightPct: 25 },
                    { name: 'Empresa D', weightPct: 15 },
                ]),
            navBefore: z.number().min(10).max(1000).default(100),
        })
        .refine((props) => Math.abs(props.holdings.reduce((sum, h) => sum + h.weightPct, 0) - 100) < 0.01, {
            message: 'Os pesos da cesta precisam somar 100%',
        }),
    'fii-monthly-calendar': z.object({
        monthlyPerShare: z.number().min(0.01).max(50).default(1.1),
        shares: z.number().int().min(1).max(1_000_000).default(100),
        price: z.number().min(1).max(1000).default(100),
        payoutBusinessDay: z.number().int().min(5).max(15).default(10),
    }),
    'fee-drag': z.object({
        initial: z.number().min(0).max(1_000_000).default(10000),
        monthly: z.number().min(0).max(100_000).default(0),
        grossReturnPct: z.number().min(2).max(16).default(10),
        feeAPct: z.number().min(0).max(4).default(0),
        feeBPct: z.number().min(0).max(4).default(2),
        years: z.number().int().min(1).max(40).default(20),
    }),
    'risk-return-scatter': z.object({
        highlight: z.enum(['savings', 'selic-bond', 'cdb', 'ipca-bond', 'fii', 'stocks']).default('stocks'),
        profile: z.enum(['none', 'conservative', 'moderate', 'aggressive']).default('none'),
    }),
    'allocation-donut': z.object({
        profile: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
        amount: z.number().min(100).max(1_000_000).default(10000),
    }),
    'risk-profile-quiz': emptyProps,
    'behavior-bias-quiz': emptyProps,
    'budget-split': z.object({
        income: z.number().min(1000).max(20_000).default(4000),
        housing: z.number().min(0).max(10_000).default(1500),
        food: z.number().min(0).max(10_000).default(800),
        transport: z.number().min(0).max(10_000).default(400),
        leisure: z.number().min(0).max(10_000).default(300),
        debts: z.number().min(0).max(10_000).default(200),
        other: z.number().min(0).max(10_000).default(200),
    }),
    'debt-snowball': z.object({
        balance: z.number().min(500).max(50_000).default(5000),
        monthlyRatePct: z.number().min(0.5).max(16).default(5),
        payment: z.number().min(50).max(5000).default(600),
    }),
    'pay-or-invest': z.object({
        amount: z.number().min(100).max(100_000).default(1000),
        debtMonthlyPct: z.number().min(0.5).max(16).default(5),
        investAnnualPct: z.number().min(4).max(20).default(14),
        irPct: z.number().min(0).max(22.5).default(15),
    }),
    'equity-tax-calculator': z.object({
        kind: z.enum(['swing', 'daytrade']).default('swing'),
        assetClass: z.enum(['stock', 'etf', 'fii']).default('stock'),
        salesMonth: z.number().min(0).max(100_000).default(15000),
        profit: z.number().min(-10_000).max(20_000).default(2000),
        lossCarry: z.number().min(0).max(10_000).default(0),
    }),
    'tax-decision-tree': emptyProps,
    'rating-ruler': z.object({ highlight: z.enum(['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D']).default('AA') }),
    'savings-vs-selic': z.object({
        selicPct: z.number().min(2).max(16).default(14),
        trMonthlyPct: z.number().min(0).max(0.3).default(0.15),
        amount: z.number().positive().default(10000),
        months: z.number().int().min(1).max(36).default(12),
    }),
    'growth-calculator': emptyProps,
    'fixed-income-comparison': emptyProps,
    'live-indicator': z.object({ ticker: z.string().min(1).max(20) }),
    'live-macro': z.object({ windowDays: z.number().int().min(7).max(365).optional() }),
} as const satisfies Record<WidgetId, z.ZodType>

export type WidgetProps<Id extends WidgetId> = z.output<(typeof widgetPropsSchemas)[Id]>

const textBlock = z.object({ type: z.literal('text'), markup: z.string().min(1) })

// As props ficam `unknown` aqui e são validadas por widget na hora de
// renderizar (`LessonWidget`), para um widget com props ruins virar fallback
// só dele, e não invalidar a lição inteira.
const widgetBlock = z.object({
    type: z.literal('widget'),
    id: z.string().min(1),
    widget: z.string().min(1),
    props: z.unknown().default({}),
    caption: z.string().min(1).optional(),
})

// Pergunta intermediária (RC.3.2), como o servidor a entrega: sem gabarito nem
// explicação (`answer`/`explanation` ficam só no servidor).
const checkBlock = z.object({
    type: z.literal('check'),
    id: z.string().min(1),
    kind: z.enum(['single', 'true_false']),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(4).optional(),
})

const lessonBlocksSchema = z.object({
    schemaVersion: z.literal(1),
    phases: z.object({
        scenario: z.array(z.union([textBlock, widgetBlock, checkBlock])),
        microDecision: z.array(z.union([textBlock, widgetBlock, checkBlock])),
        revelation: z.array(z.union([textBlock, widgetBlock, checkBlock])),
    }),
    // "O que ficou" (LJ.1.5): mostrado na tela final; lição sem resumo só omite o bloco.
    summary: z.array(z.string().min(1).max(120)).min(2).max(3).optional(),
})

export type LessonBlocks = z.infer<typeof lessonBlocksSchema>
export type LessonBlock = LessonBlocks['phases']['scenario'][number]
export type WidgetBlock = Extract<LessonBlock, { type: 'widget' }>
export type CheckBlock = Extract<LessonBlock, { type: 'check' }>

// Ausente ou fora do contrato vira `null` (o player usa o texto legado).
export function parseLessonBlocks(raw: unknown): LessonBlocks | null {
    if (raw === null || raw === undefined) {
        return null
    }
    const result = lessonBlocksSchema.safeParse(raw)
    return result.success ? result.data : null
}
