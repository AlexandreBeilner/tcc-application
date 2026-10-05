import type { ComponentType } from 'react'
import type { ZodType } from 'zod'
import { widgetPropsSchemas } from '../../../features/lessons/widgets/schema'
import type { WidgetId, WidgetProps } from '../../../features/lessons/widgets/schema'
import { CompoundGrowthWidget, compoundGrowthSummary } from '../CompoundGrowthWidget'
import { CopomTimelineWidget, copomTimelineSummary } from '../CopomTimelineWidget'
import { EmergencyFundCalculatorWidget, emergencyFundCalculatorSummary } from '../EmergencyFundCalculatorWidget'
import { WhereToKeepWidget, whereToKeepSummary } from '../WhereToKeepWidget'
import { InflationSelicSeesawWidget, inflationSelicSeesawSummary } from '../InflationSelicSeesawWidget'
import { FgcCoverageBarWidget, fgcCoverageBarSummary } from '../FgcCoverageBarWidget'
import { MtmSeesawWidget, mtmSeesawSummary } from '../MtmSeesawWidget'
import { RatingRulerWidget, ratingRulerSummary } from '../RatingRulerWidget'
import { RealReturnWidget, realReturnSummary } from '../RealReturnWidget'
import { SavingsVsSelicWidget, savingsVsSelicSummary } from '../SavingsVsSelicWidget'
import { SelicIpcaChartWidget, selicIpcaChartSummary } from '../SelicIpcaChartWidget'
import { EquivalentRateWidget, equivalentRateSummary } from '../EquivalentRateWidget'
import { IrRegressiveTableWidget, irRegressiveTableSummary } from '../IrRegressiveTableWidget'
import { ProductComparatorWidget, productComparatorSummary } from '../ProductComparatorWidget'
import { FixedIncomeComparisonForm } from '../FixedIncomeComparisonForm'
import { GrowthCalculatorForm } from '../GrowthCalculatorForm'
import { LessonCallout } from '../LessonCallout'
import { LiveIndicatorWidget } from '../LiveIndicatorWidget'
import { LiveMacroWidget } from '../LiveMacroWidget'
import { PlatformNote, platformNoteSummary } from '../PlatformNote'

export interface WidgetDefinition<Id extends WidgetId> {
    component: ComponentType<WidgetProps<Id>>
    propsSchema: ZodType<WidgetProps<Id>>
    // Resumo textual (leitor de tela e fallback): todo widget tem um.
    summary: (props: WidgetProps<Id>) => string
}

type Registry = { [Id in WidgetId]: WidgetDefinition<Id> }

// Registro único de widgets de lição (RC.3.1): adicionar um widget = uma
// entrada aqui + o schema em `widgets/schema` (e o espelho no backend),
// sem tocar no player. Props são só configuração; a saída é só visual.
export const widgetRegistry: Registry = {
    callout: {
        component: LessonCallout,
        propsSchema: widgetPropsSchemas.callout,
        summary: (props) => `${props.title}. ${props.body}`,
    },
    'platform-note': {
        component: PlatformNote,
        propsSchema: widgetPropsSchemas['platform-note'],
        summary: platformNoteSummary,
    },
    'equivalent-rate': {
        component: EquivalentRateWidget,
        propsSchema: widgetPropsSchemas['equivalent-rate'],
        summary: equivalentRateSummary,
    },
    'ir-regressive-table': {
        component: IrRegressiveTableWidget,
        propsSchema: widgetPropsSchemas['ir-regressive-table'],
        summary: irRegressiveTableSummary,
    },
    'product-comparator': {
        component: ProductComparatorWidget,
        propsSchema: widgetPropsSchemas['product-comparator'],
        summary: productComparatorSummary,
    },
    'compound-growth': {
        component: CompoundGrowthWidget,
        propsSchema: widgetPropsSchemas['compound-growth'],
        summary: compoundGrowthSummary,
    },
    'real-return': {
        component: RealReturnWidget,
        propsSchema: widgetPropsSchemas['real-return'],
        summary: realReturnSummary,
    },
    'selic-ipca-chart': {
        component: SelicIpcaChartWidget,
        propsSchema: widgetPropsSchemas['selic-ipca-chart'],
        summary: selicIpcaChartSummary,
    },
    'copom-timeline': {
        component: CopomTimelineWidget,
        propsSchema: widgetPropsSchemas['copom-timeline'],
        summary: copomTimelineSummary,
    },
    'inflation-selic-seesaw': {
        component: InflationSelicSeesawWidget,
        propsSchema: widgetPropsSchemas['inflation-selic-seesaw'],
        summary: inflationSelicSeesawSummary,
    },
    'emergency-fund-calculator': {
        component: EmergencyFundCalculatorWidget,
        propsSchema: widgetPropsSchemas['emergency-fund-calculator'],
        summary: emergencyFundCalculatorSummary,
    },
    'where-to-keep': {
        component: WhereToKeepWidget,
        propsSchema: widgetPropsSchemas['where-to-keep'],
        summary: whereToKeepSummary,
    },
    'mtm-seesaw': {
        component: MtmSeesawWidget,
        propsSchema: widgetPropsSchemas['mtm-seesaw'],
        summary: mtmSeesawSummary,
    },
    'fgc-coverage-bar': {
        component: FgcCoverageBarWidget,
        propsSchema: widgetPropsSchemas['fgc-coverage-bar'],
        summary: fgcCoverageBarSummary,
    },
    'rating-ruler': {
        component: RatingRulerWidget,
        propsSchema: widgetPropsSchemas['rating-ruler'],
        summary: ratingRulerSummary,
    },
    'savings-vs-selic': {
        component: SavingsVsSelicWidget,
        propsSchema: widgetPropsSchemas['savings-vs-selic'],
        summary: savingsVsSelicSummary,
    },
    'growth-calculator': {
        component: GrowthCalculatorForm,
        propsSchema: widgetPropsSchemas['growth-calculator'],
        summary: () => 'Calculadora de juros: capital inicial, aporte mensal, taxa e prazo.',
    },
    'fixed-income-comparison': {
        component: FixedIncomeComparisonForm,
        propsSchema: widgetPropsSchemas['fixed-income-comparison'],
        summary: () => 'Comparador de renda fixa com e sem imposto de renda.',
    },
    'live-indicator': {
        component: LiveIndicatorWidget,
        propsSchema: widgetPropsSchemas['live-indicator'],
        summary: (props) => `Indicadores ao vivo de ${props.ticker}.`,
    },
    'live-macro': {
        component: LiveMacroWidget,
        propsSchema: widgetPropsSchemas['live-macro'],
        summary: () => 'Selic e IPCA mais recentes.',
    },
}
