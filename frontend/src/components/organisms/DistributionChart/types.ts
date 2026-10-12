import type { AssetCategory, CategorySlice } from '../../../features/portfolio/distribution'

export interface DistributionChartProps {
    slices: CategorySlice[]
    // Quando informado, clicar numa fatia ou linha da legenda abre outra tela em vez de só fixar o
    // destaque (MO.8.4). Passar o mouse ou focar continua destacando e mostrando valor e % no furo.
    onSelect?: (category: AssetCategory) => void
}
